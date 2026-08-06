import { env } from "@/lib/env"
import { hc } from "hono/client"
import type { AppType } from "."

/**
 * Hono client for making API requests to the server.
 *
 * Note: This can be used on both server and client.
 */
export const apiClient = hc<AppType>(env.NEXT_PUBLIC_APP_URL, {
  async headers() {
    if (typeof window === "undefined") {
      const { cookies } = require("next/headers")
      const cookieString = (await cookies()).toString()
      return {
        Cookie: cookieString,
      }
    }
    return {
      Cookie: document.cookie,
    } as Record<string, string>
  },
  // The file/github/ai routers are now thin proxies to the backend server, so
  // we relax the client type to `any` to avoid bundling their implementations
  // into the Cloudflare Worker (keeps the Worker under the 3 MiB free limit).
  // The react-query wrappers in @/lib/api still provide typed hooks.
}).api as any
