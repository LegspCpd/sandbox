import { neon } from "@neondatabase/serverless" // Neon serverless driver (works on Cloudflare Workers + Node)
import { drizzle } from "drizzle-orm/neon-http" // Drizzle adapter for Neon HTTP driver
import { env } from "./env"
import * as schema from "./schema"

// Creates a Neon HTTP client from the Postgres connection string.
// Works both in Node (the backend server) and Cloudflare Workers (fetch-based).
export const sql = neon(env.DATABASE_URL)

export const db = drizzle(sql, { schema })
export { schema }
