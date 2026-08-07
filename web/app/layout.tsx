import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "Sandbox",
  description:
    "开源的云端代码编辑环境，支持 AI 代码生成、实时预览、实时协作与 AI 对话",
  metadataBase: new URL("https://code.legspcpd.top/"),
  openGraph: {
    type: "website",
    url: "https://code.legspcpd.top",
    title: "Sandbox",
    description:
      "开源的云端代码编辑环境，支持 AI 代码生成、实时预览、实时协作与 AI 对话",
  },
  twitter: {
    site: "https://code.legspcpd.top",
    title: "Sandbox",
    description:
      "开源的云端代码编辑环境，支持 AI 代码生成、实时预览、实时协作与 AI 对话",
    creator: "@gitwitdev",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
