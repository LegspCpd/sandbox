# 部署手册（Vercel + Back4App Containers，方案 D1：本地沙箱）

本手册针对 **新版（GitWit monorepo）** 的部署。架构：

| 组件                       | 位置                        | 技术                     |
| -------------------------- | --------------------------- | ------------------------ |
| 前端 + 用户/项目/AI        | Vercel                      | Next.js 16               |
| 实时后端（终端/预览/协同） | Back4App Containers         | Express + Socket.IO      |
| 文件操作 / GitHub 同步     | Back4App Containers（/api） | Hono REST（本地沙箱）    |
| 数据库                     | Neon（PostgreSQL）          | Drizzle ORM              |
| 代码沙箱                   | Back4App 容器内             | **本地沙箱（无需 E2B）** |
| 登录                       | Clerk                       | Clerk                    |

> 说明：**不需要 E2B、也不需要 Liveblocks**。代码沙箱改为在 Back4App 的容器里直接用本地目录 + 进程运行（`lib/services/LocalSandbox.ts`）。`web` 的 `/api/file`、`/api/github`、`/api/ai` 会转发到 Back4App 执行。

> ⚠️ 前端原本考虑部署 Cloudflare Workers，但免费版 3MB 上限装不下（Next.js 16 打包后 3.68MB），**改用 Vercel**（免费版无此限制，且对 Next.js 原生支持）。

> ⚠️ 安全提醒：`DATABASE_URL` 含数据库密码，请放在 gitignored 的 `.env` 里，**不要**提交到仓库。

---

## 0. 需要的账号 / 密钥

| 服务                | 用途     | 去哪拿                                                |
| ------------------- | -------- | ----------------------------------------------------- |
| Clerk               | 登录     | https://dashboard.clerk.com 新建应用                  |
| Neon                | 数据库   | https://neon.tech 新建数据库，复制连接串              |
| Vercel              | 托管前端 | https://vercel.com 用 GitHub 登录并导入仓库           |
| Back4App Containers | 托管后端 | https://www.back4app.com/containers 绑定 GitHub       |
| GitHub OAuth        | 应用必用 | https://github.com/settings/developers 新建 OAuth App |

> **不需要 E2B 账号**（本地沙箱直接跑在 Back4App Containers 上）。

---

## 1. 本地环境变量

在仓库根目录建 `.env`（参考 `.env.example`）：

```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<dbname>?sslmode=require

E2B_API_KEY=...
CLERK_SECRET_KEY=<你的Clerk Secret Key>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<你的Clerk Publishable Key>
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
ENCRYPTION_KEY=<32字节hex，可选>
```

## 2. 数据库迁移（对 Neon 执行）

```bash
npm run db:migrate:prod   # NODE_ENV=production 会读取根 .env 的 DATABASE_URL
```

## 3. 本地跑通

```bash
npm run dev
```

- 前端：http://localhost:3000
- 后端：http://localhost:4000（Socket.IO）

## 4. 部署后端到 Back4App Containers

1. 把代码推到你的 GitHub 仓库
2. Back4App Containers 控制台 → 创建 Container App → 连接你的 GitHub 仓库 → 构建使用根目录的 `Dockerfile`
3. 端口设为 **4000**（REST + Socket.IO + 预览代理共用）
4. 环境变量：

```env
PORT=4000
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
# 可选：项目文件根目录（默认 ./projects）
PROJECTS_DIR=/app/projects
```

5. 部署后拿到 Back4App 给你的公网域名，例如 `https://<你的应用名>.back4app.io`（这就是 `NEXT_PUBLIC_SERVER_URL`）

> Back4App 上不需要 E2B_API_KEY（本地沙箱不连 E2B）。

## 5. 部署前端到 Vercel（正式域名：code.legspcpd.top）

`web/vercel.json` 已配置好 monorepo 构建（`npm run build:web` 会先用 turbo 构建依赖包再 `next build`）。

1. 把代码推到你的 GitHub 仓库
2. 到 https://vercel.com 用 GitHub 登录 → **Add New Project** → 导入这个仓库
3. 项目设置里：
   - **Root Directory**：填 `web`
   - **Framework Preset**：Next.js（自动识别）
4. 配置环境变量（Production + Preview 都要）：

```env
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=https://code.legspcpd.top
NEXT_PUBLIC_SERVER_URL=https://<你的应用名>.back4app.io
# 可选
ENCRYPTION_KEY=...
```

5. 点 **Deploy**
6. 部署后在 Vercel 项目 → **Settings → Domains** 添加 `code.legspcpd.top`，按提示在 Cloudflare DNS 加一条 CNAME 指向 Vercel

> 前端在 Vercel 上运行 Next.js（nodejs runtime），`/api/file`、`/api/github`、`/api/ai` 通过环境变量 `NEXT_PUBLIC_SERVER_URL` 转发到 Back4App 后端执行。

## 6. Clerk 配置

- 在 Clerk 后台把 **Instance URL** / 域名白名单设为 **`https://code.legspcpd.top`**
- Clerk 应用的允许回调地址要包含 `https://code.legspcpd.top`

## 7. GitHub OAuth 配置（正式域名）

- 新建 OAuth App（https://github.com/settings/developers）
- Homepage URL：**`https://code.legspcpd.top`**
- Authorization callback URL：**`https://code.legspcpd.top`**（本地开发时改成 `http://localhost:3000`）
- 说明：应用通过弹窗做 OAuth，GitHub 跳回回调地址后从 URL 里读 `?code=`，所以回调地址就是前端地址本身

## 8. 沙盒模板（无需手动部署）

模板文件（`templates/<类型>/`）会在用户**首次打开项目时自动复制**到本地沙箱目录，并自动执行 `npm install`。无需像旧版那样手动 `npm run templates:deploy`。

## 9. 端到端验证

1. 打开你的域名 → 注册/登录
2. 新建项目 → 打开终端（验证本地沙箱 + Back4App Socket）
3. 实时预览（`/preview/<项目id>/` 由 Back4App 代理到本地 dev server）
4. GitHub 同步（验证 OAuth）

## 常见问题

- **前端为什么用 Vercel 不用 Cloudflare**：Next.js 16 打包后 3.68MB，Cloudflare 免费版限 3MB，放不下；Vercel 免费版无此限制
- **AI 聊天/文件操作**：Cloudflare/Vercel 前端只做转发，实际由 Back4App 后端执行（本地沙箱）
- **预览只对 vite/next 模板做了路径重写**：其它模板（streamlit/php）预览可能不完整
- **图片不显示**：已设置 `images.unoptimized: true`，直接返回原图；若要在 Vercel 上启用图片优化，可删除该设置
