// ============================================================
// LocalSandbox — a drop-in replacement for the E2B "Sandbox" API
// used by this codebase. Instead of spinning up a cloud VM, it
// uses a local directory + local processes (fs + child_process +
// node-pty). This lets the app run WITHOUT an E2B account.
//
// The project files live in:  <PROJECTS_DIR>/<sandboxId>
// (PROJECTS_DIR defaults to ./projects next to the running server)
// ============================================================
import { exec } from "child_process"
import fs from "fs"
import fsp from "fs/promises"
import path from "path"
// node-pty is a NATIVE module — import only its types so it is NOT loaded
// when bundled into edge environments (Cloudflare Workers) that never
// create terminals. It is required lazily in createPty.
import type { IPty } from "node-pty"

// Root directory where every project's files are stored
export const PROJECTS_ROOT =
  process.env.PROJECTS_DIR || path.join(process.cwd(), "projects")

// Public base URL of the server (used to build preview URLs)
export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  `http://localhost:${process.env.PORT || 4000}`

// Registry mapping projectId -> dev-server port (for the preview proxy)
export const previewPorts = new Map<string, number>()

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface FileSystemEntry {
  name: string
  path: string
  type: "file" | "dir"
}

export enum FilesystemEventType {
  CREATE = "CREATE",
  REMOVE = "REMOVE",
  RENAME = "RENAME",
  CHANGE = "CHANGE",
}

export interface FilesystemEvent {
  type: FilesystemEventType
  path: string
}

export interface WatchHandle {
  stop(): Promise<void>
}

export interface PtyHandle {
  pid: number
  kill(): Promise<void>
}

export class NotFoundError extends Error {
  name = "NotFoundError"
}

interface PtyCreateOptions {
  rows?: number
  cols?: number
  timeoutMs?: number
  onData?: (data: Uint8Array) => void
}

/**
 * Copies a source directory into a destination directory, ignoring
 * the same patterns E2B's Template builder used (dotfiles, e2b*,
 * node_modules, template.ts).
 */
async function copyTemplateFiles(srcDir: string, destDir: string) {
  const entries = await fsp.readdir(srcDir, { withFileTypes: true })
  await fsp.mkdir(destDir, { recursive: true })
  for (const entry of entries) {
    const name = entry.name
    if (
      name === "template.ts" ||
      name.startsWith("e2b") ||
      name === "node_modules" ||
      name.startsWith(".")
    ) {
      continue
    }
    const src = path.join(srcDir, name)
    const dest = path.join(destDir, name)
    if (entry.isDirectory()) {
      await copyTemplateFiles(src, dest)
    } else {
      await fsp.mkdir(path.dirname(dest), { recursive: true })
      await fsp.copyFile(src, dest)
    }
  }
}

/**
 * Resolves the directory that contains the template source files for
 * a given template type (e.g. "reactjs" -> <templates-package>/reactjs).
 */
function resolveTemplateDir(templateType: string): string | null {
  try {
    const pkgEntry = require.resolve("@gitwit/templates")
    // pkgEntry points at <pkg>/dist/index.js -> walk up two dirs to the pkg root
    const pkgRoot = path.dirname(path.dirname(pkgEntry))
    const templateDir = path.join(pkgRoot, templateType)
    if (fs.existsSync(templateDir)) return templateDir
    return null
  } catch (e) {
    console.error("[LocalSandbox] Could not resolve @gitwit/templates:", e)
    return null
  }
}

export class LocalSandbox {
  sandboxId: string
  projectDir: string

  private ptys = new Map<number, IPty>()

  constructor(sandboxId: string, projectDir: string) {
    this.sandboxId = sandboxId
    this.projectDir = projectDir
  }

  /** Absolute path to the project's files (used by FileManager). */
  get projectRoot(): string {
    return this.projectDir
  }

  /**
   * Resolves a (possibly project-relative) path and guarantees the result
   * stays inside the project directory (blocks "../" escape attempts).
   */
  private resolveWithin(filePath: string): string {
    const resolved = path.resolve(this.projectDir, filePath)
    const rel = path.relative(this.projectDir, resolved)
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new NotFoundError(`Path "${filePath}" is outside the project`)
    }
    return resolved
  }

  /** The "container" is always running — it's a local directory. */
  async isRunning(): Promise<boolean> {
    return fs.existsSync(this.projectDir)
  }

  /**
   * Kept for API compatibility with the heartbeat route. The local
   * sandbox never auto-pauses, so this is a no-op.
   */
  async setTimeout(_timeoutMs: number): Promise<void> {
    // no-op
  }

  /**
   * Called when a dev server is detected in a terminal. Registers the
   * port so the preview proxy can route to it, and returns the public
   * URL the frontend iframe should load.
   */
  getHost(port: number): string {
    previewPorts.set(this.sandboxId, port)
    return `${SERVER_URL}/preview/${this.sandboxId}/`
  }

  // ------------------------------------------------------------------
  // commands.run — run a shell command inside the project directory
  // ------------------------------------------------------------------
  commands = {
    run: (cmd: string, opts?: { timeoutMs?: number }) =>
      this.runCommand(cmd, opts?.timeoutMs),
  }

  private runCommand(cmd: string, timeoutMs?: number): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      exec(
        cmd,
        {
          cwd: this.projectDir,
          timeout: timeoutMs ?? 120_000,
          maxBuffer: 20 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          const exitCode =
            error && typeof (error as any).code === "number"
              ? (error as any).code
              : error
                ? 1
                : 0
          const result: CommandResult = {
            stdout: stdout ?? "",
            stderr: stderr ?? "",
            exitCode,
          }
          // E2B's commands.run throws on non-zero exit — keep that behaviour
          if (error) {
            reject(
              new Error(
                result.stderr || `Command failed with code ${exitCode}`,
              ),
            )
          } else {
            resolve(result)
          }
        },
      )
    })
  }

  // ------------------------------------------------------------------
  // files — file system operations scoped to the project directory
  // ------------------------------------------------------------------
  files = {
    read: (filePath: string) => this.readFile(filePath),
    write: (filePath: string, content: string) =>
      this.writeFile(filePath, content),
    remove: (filePath: string) => this.removeFile(filePath),
    makeDir: (filePath: string) => this.makeDir(filePath),
    list: (dirPath: string) => this.listDir(dirPath),
    watchDir: (
      dir: string,
      cb: (event: FilesystemEvent) => void,
      opts?: { timeoutMs?: number },
    ) => this.watchDir(dir, cb, opts),
  }

  private async readFile(filePath: string): Promise<string> {
    const full = this.resolveWithin(filePath)
    try {
      return await fsp.readFile(full, "utf-8")
    } catch (e: any) {
      if (e?.code === "ENOENT" || e?.code === "EISDIR") {
        throw new NotFoundError(`Path "${filePath}" does not exist`)
      }
      throw e
    }
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    const full = this.resolveWithin(filePath)
    await fsp.mkdir(path.dirname(full), { recursive: true })
    await fsp.writeFile(full, content, "utf-8")
  }

  private async removeFile(filePath: string): Promise<void> {
    const full = this.resolveWithin(filePath)
    await fsp.rm(full, { recursive: true, force: true })
  }

  private async makeDir(filePath: string): Promise<void> {
    const full = this.resolveWithin(filePath)
    await fsp.mkdir(full, { recursive: true })
  }

  private async listDir(dirPath: string): Promise<FileSystemEntry[]> {
    const full = this.resolveWithin(dirPath)
    let entries
    try {
      entries = await fsp.readdir(full, { withFileTypes: true })
    } catch (e: any) {
      if (e?.code === "ENOENT") {
        throw new NotFoundError(`Directory "${dirPath}" does not exist`)
      }
      throw e
    }
    return entries.map((entry) => ({
      name: entry.name,
      path: path.posix.join(dirPath, entry.name),
      type: entry.isDirectory() ? ("dir" as const) : ("file" as const),
    }))
  }

  private async watchDir(
    dir: string,
    cb: (event: FilesystemEvent) => void,
    _opts?: { timeoutMs?: number },
  ): Promise<WatchHandle> {
    const full = this.resolveWithin(dir)
    await fsp.mkdir(full, { recursive: true })
    const watcher = fs.watch(full, { recursive: true })
    watcher.on("change", (_eventType, filename) => {
      const name = filename?.toString() ?? ""
      // node fs.watch only reports "rename"|"change"; map to our event types
      cb({
        type:
          _eventType === "rename"
            ? FilesystemEventType.RENAME
            : FilesystemEventType.CHANGE,
        path: name,
      })
    })
    watcher.on("error", (e) => {
      console.error(`[LocalSandbox] watch error on ${full}:`, e)
    })
    return {
      stop: async () => {
        watcher.close()
      },
    }
  }

  // ------------------------------------------------------------------
  // pty — pseudo-terminals (real interactive shells) via node-pty
  // ------------------------------------------------------------------
  pty = {
    create: (opts?: PtyCreateOptions) => this.createPty(opts),
    sendInput: (pid: number, data: Uint8Array) => this.sendInput(pid, data),
    resize: (pid: number, size: { cols: number; rows: number }) =>
      this.resize(pid, size),
  }

  private createPty(opts?: PtyCreateOptions): PtyHandle {
    const cols = opts?.cols ?? 80
    const rows = opts?.rows ?? 20
    // Lazy require — node-pty is a native addon and must not be loaded on
    // Cloudflare Workers. It is only needed on the Node backend server.

    const pty = require("node-pty") as typeof import("node-pty")
    const term = pty.spawn("bash", [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: this.projectDir,
      env: process.env as Record<string, string>,
    })
    term.onData((data) => {
      opts?.onData?.(new TextEncoder().encode(data))
    })
    this.ptys.set(term.pid, term)
    return {
      pid: term.pid,
      kill: async () => {
        try {
          term.kill()
        } catch (e) {
          console.error("[LocalSandbox] error killing pty:", e)
        }
        this.ptys.delete(term.pid)
      },
    }
  }

  private sendInput(pid: number, data: Uint8Array): void {
    const term = this.ptys.get(pid)
    if (!term) return
    term.write(new TextDecoder().decode(data))
  }

  private resize(pid: number, size: { cols: number; rows: number }): void {
    const term = this.ptys.get(pid)
    if (!term) return
    try {
      term.resize(size.cols, size.rows)
    } catch (e) {
      console.error("[LocalSandbox] error resizing pty:", e)
    }
  }

  // ------------------------------------------------------------------
  // Factories
  // ------------------------------------------------------------------

  /**
   * "Creates" a container: scaffolds a project directory from a template
   * (or empty) and runs npm install for node-based templates.
   */
  static async create(
    sandboxId: string,
    templateType: string,
  ): Promise<LocalSandbox> {
    const projectDir = path.join(PROJECTS_ROOT, sandboxId)
    await fsp.mkdir(projectDir, { recursive: true })

    if (templateType && templateType !== "empty") {
      const templateDir = resolveTemplateDir(templateType)
      if (templateDir) {
        console.log(
          `[LocalSandbox] Scaffolding template "${templateType}" from ${templateDir}`,
        )
        await copyTemplateFiles(templateDir, projectDir)
      } else {
        console.warn(
          `[LocalSandbox] No template dir found for "${templateType}", creating empty project`,
        )
      }
    }

    const sandbox = new LocalSandbox(sandboxId, projectDir)

    // Install dependencies if the template ships a package.json
    if (fs.existsSync(path.join(projectDir, "package.json"))) {
      console.log(`[LocalSandbox] Running npm install for ${sandboxId}...`)
      await sandbox.runCommand("npm install", 10 * 60_000)
      console.log(`[LocalSandbox] npm install finished for ${sandboxId}`)
    }

    return sandbox
  }

  /**
   * "Connects" to an existing container: the project directory should
   * already exist.
   */
  static async connect(sandboxId: string): Promise<LocalSandbox> {
    const projectDir = path.join(PROJECTS_ROOT, sandboxId)
    await fsp.mkdir(projectDir, { recursive: true })
    return new LocalSandbox(sandboxId, projectDir)
  }
}
