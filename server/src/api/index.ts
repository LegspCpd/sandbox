import { clerkAuth } from "./clerkAuth"
import createApp from "./create-app"
import { fileRouter } from "./file"
import { githubRouter } from "./github"

// The backend REST API — mounted on the Express server under /api.
// Contains the operations that need access to the LOCAL sandbox
// (file read/write + GitHub sync), which cannot run on Cloudflare.
const apiApp = createApp()
  .use(clerkAuth)
  .route("/file", fileRouter)
  .route("/github", githubRouter)

export type ApiAppType = typeof apiApp
export default apiApp
