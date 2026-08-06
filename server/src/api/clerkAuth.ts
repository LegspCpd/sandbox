import { createClerkClient, verifyToken } from "@clerk/backend"
import { createMiddleware } from "hono/factory"
import type { AppBindings } from "./types"

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
})

export const clerkAuth = createMiddleware<AppBindings>(async (c, next) => {
  let token = c.req.header("Authorization")?.split(" ")[1]

  try {
    // If no bearer token, try session cookie
    if (!token) {
      const authResult = await clerk.authenticateRequest(c.req.raw)
      if (!authResult.token || !authResult.isSignedIn) {
        return c.json({ error: "Unauthorized: No valid session" }, 401)
      }
      token = authResult.token
    }

    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })

    const user = await clerk.users.getUser(decoded.sub)
    c.set("user", user)
    return next()
  } catch (error) {
    console.error("Clerk auth error:", error)
    return c.json({ error: "Unauthorized" }, 401)
  }
})
