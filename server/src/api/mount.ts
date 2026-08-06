import type { Express, Request, Response } from "express"
import type { Hono } from "hono"

/**
 * Mounts a Hono app on an Express app at the given prefix.
 * Uses a streaming adapter so SSE / streaming responses work.
 */
export function mountHono(app: Express, honoApp: Hono<any, any, any>, prefix = "/api") {
  app.use(prefix, async (req: Request, res: Response) => {
    try {
      const url = new URL(req.originalUrl, `http://${req.headers.host || "localhost"}`)
      const headers = new Headers()
      Object.entries(req.headers).forEach(([k, v]) => {
        if (typeof v === "string") headers.set(k, v)
        else if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
      })

      const init: RequestInit = { method: req.method, headers }
      if (req.method !== "GET" && req.method !== "HEAD") {
        // Stream the Express request body into the Hono Request
        init.body = new ReadableStream<Uint8Array>({
          start(controller) {
            req.on("data", (chunk) => controller.enqueue(chunk))
            req.on("end", () => controller.close())
            req.on("error", (err) => controller.error(err))
          },
        })
      }

      const honoReq = new Request(url.toString(), init)
      const honoRes = await honoApp.fetch(honoReq)

      res.status(honoRes.status)
      honoRes.headers.forEach((value, key) => res.setHeader(key, value))
      res.flushHeaders?.()

      if (honoRes.body) {
        const reader = honoRes.body.getReader()
        const pump = async () => {
          try {
            const { done, value } = await reader.read()
            if (done) {
              res.end()
              return
            }
            res.write(Buffer.from(value))
            pump()
          } catch (e) {
            res.end()
          }
        }
        pump()
      } else {
        res.end()
      }
    } catch (error) {
      console.error("[mountHono] error:", error)
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Internal error" })
      } else {
        res.end()
      }
    }
  })
}
