import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load parent .env first
// Then load local .env to override
dotenv.config({ path: path.resolve(__dirname, "../.env") })
dotenv.config({ path: path.resolve(__dirname, ".env") })

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native/Node-only modules that must NOT be bundled into the Worker.
  // They are never used on Cloudflare (local sandbox runs on the backend server).
  serverExternalPackages: ["node-pty", "e2b", "ssh2"],
  async headers() {
    return [
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable", // 1 year
          },
        ],
      },
    ]
  },

  images: {
    // Deployed on Cloudflare Workers (free plan) without Cloudflare Images —
    // serve original images instead of running next/image optimization.
    unoptimized: true,
    remotePatterns: [
      {
        hostname: "cdn.simpleicons.org",
      },
      {
        hostname: "img.clerk.com",
      },
      {
        hostname: "images.clerk.dev",
      },
    ],
  },
  reactCompiler: true,
}

export default nextConfig
