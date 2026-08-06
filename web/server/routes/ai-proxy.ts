import { createRouter } from "@/lib/api/create-app"
import { zValidator } from "@hono/zod-validator"
import z from "zod"
import { proxyRequest } from "@/server/proxy"

// Proxy-only AI routes: forwards every request to the backend server so the
// @ai-sdk/* packages are NOT bundled into the Cloudflare Worker. This keeps
// the Worker under the free-plan 3 MiB size limit while preserving the same
// API paths/types used by the frontend client.
export const aiProxyRouter = createRouter()
  .post("/stream-chat", zValidator("json", z.any()), async (c) => proxyRequest(c))
  .post("/process-edit", zValidator("json", z.any()), async (c) =>
    proxyRequest(c),
  )
  .post("/merge-code", zValidator("json", z.any()), async (c) =>
    proxyRequest(c),
  )
