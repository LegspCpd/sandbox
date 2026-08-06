import { createRouter } from "@/lib/api/create-app"
import { env } from "@/lib/env"
import type { Context } from "hono"

/**
 * Forwards a request to the backend server (which runs the local sandbox).
 * The web app (Cloudflare Workers) cannot run the LOCAL sandbox, so the
 * file + GitHub (+ AI) operations are forwarded to the backend server,
 * which implements them against the local project directory. The original
 * auth headers/cookies are passed through so the backend can re-verify
 * the Clerk session.
 */
export async function proxyRequest(c: Context): Promise<Response> {
  const serverUrl = env.NEXT_PUBLIC_SERVER_URL
  const url = c.req.url
  const path = new URL(url).pathname // full path incl. /api/...
  const search = new URL(url).search
  const target = `${serverUrl}${path}${search}`

  const headers = new Headers(c.req.raw.headers)
  headers.delete("host")
  headers.delete("connection")
  headers.delete("content-length")
  headers.delete("transfer-encoding")

  const init: RequestInit = { method: c.req.method, headers }
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    init.body = c.req.raw.body
  }

  const res = await fetch(target, init)
  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  })
}

/**
 * Generic reverse-proxy router (mounted as a typed sub-router).
 */
export function createProxyRouter() {
  const router = createRouter()
  const methods = ["get", "post", "put", "patch", "delete"] as const

  for (const method of methods) {
    router[method]("/*", async (c) => proxyRequest(c))
  }

  return router
}
