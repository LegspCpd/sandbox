import createApp from "@/lib/api/create-app"
import { clerkAuth } from "./middlewares/clerkAuth"
import { projectRouter } from "./routes/project"
import { openUserRouter, userRouter } from "./routes/user"
import { createProxyRouter } from "./proxy"

const app = createApp()
  .route("/user", openUserRouter) // 公开路由(无需登录,如创建用户)
  .use(clerkAuth) // 之后的都需 Clerk 鉴权
  .route("/user", userRouter)
  .route("/project", projectRouter)
  // 文件 / GitHub / AI 操作都在本地沙箱（后端服务器）执行，Cloudflare 只做转发。
  // 用纯代理路由，避免把 @gitwit/lib / @ai-sdk/* 打包进 Worker（保持 < 3MB）。
  .route("/file", createProxyRouter())
  .route("/github", createProxyRouter())
  .route("/ai", createProxyRouter())

export type AppType = typeof app

export default app
