import { isClerkConfigured, verifyClerkToken } from "@gitwit/lib/utils/clerk"
import { Socket } from "socket.io"
import { z } from "zod"
// Load the database credentials
import { db } from "@gitwit/db"
import "dotenv/config"

// Initialize database

// Middleware for socket authentication
export const socketAuth = async (socket: Socket, next: Function) => {
  try {
    // Define the schema for handshake query/auth validation
    const handshakeSchema = z.object({
      token: z.string(), // Clerk token
      sandboxId: z.string(),
    })

    const q = (socket.handshake.auth as any) || socket.handshake.query
    const parseQuery = handshakeSchema.safeParse(q)

    // Check if the query is valid according to the schema
    if (!parseQuery.success) {
      next(new Error("Invalid request: Missing required fields"))
      return
    }

    const { sandboxId: projectId, token } = parseQuery.data

    // Verify Clerk token and get user
    if (!isClerkConfigured()) {
      next(new Error("Authentication system not configured"))
      return
    }

    try {
      const { user: clerkUser } = await verifyClerkToken(token)
      const userId = clerkUser.id

      // Fetch user data to verify project access using Drizzle
      const dbUserJSON = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
        with: {
          sandbox: true,
          usersToSandboxes: true,
        },
      })

      if (!dbUserJSON) {
        next(new Error("User not found"))
        return
      }

      // Check if the user owns the project or has shared access
      const project = (dbUserJSON.sandbox as any[])?.find(
        (s: any) => s.id === projectId,
      )
      const sharedProjects = (dbUserJSON.usersToSandboxes as any[])?.find(
        (uts: any) => uts.sandboxId === projectId,
      )

      // If user doesn't own or have shared access to the project, deny access
      if (!project && !sharedProjects) {
        next(new Error("Unauthorized: No access to this project"))
        return
      }

      // Set socket data with user information
      socket.data = {
        userId,
        projectId,
        isOwner: project !== undefined,
      }

      // Also set Clerk auth data
      socket.auth = {
        userId,
        user: clerkUser,
      }

      // Optional terminal/remote access password (CMD-PASS).
      // If the server sets TERMINAL_PASSWORD, every socket connection must
      // present the matching password in the handshake, otherwise the
      // connection is rejected. This prevents any signed-in user from
      // operating the host machine's terminals.
      const requiredPassword = process.env.TERMINAL_PASSWORD
      if (requiredPassword) {
        const provided = (socket.handshake.auth as any)?.password
        if (!provided || provided !== requiredPassword) {
          next(new Error("终端密码错误"))
          return
        }
      }

      // Allow the connection
      next()
    } catch (error) {
      console.error("Token verification failed:", error)
      next(new Error("Authentication failed"))
    }
  } catch (error) {
    console.error("Socket authentication error:", error)
    next(new Error("Internal server error"))
  }
}
