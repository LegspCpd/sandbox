import { KNOWN_PLATFORMS } from "@gitwit/db/constants"
import { z } from "zod"

export const editUserSchema = z.object({
  id: z.string().trim(),
  username: z.string().trim().min(1, "用户名至少需要 1 个字符"),
  oldUsername: z.string().trim(),
  name: z
    .string()
    .trim()
    .min(1, "名称至少需要 1 个字符")
    .max(80, "名称不能超过 80 个字符"),
  bio: z
    .string()
    .trim()
    .max(200, "简介不能超过 200 个字符")
    .optional(),
  personalWebsite: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || val === "" || /^https?:\/\/.+/.test(val),
      "个人网站必须是有效的 URL，以 http:// 或 https:// 开头",
    ),
  links: z
    .array(
      z.object({
        url: z.string().trim(),
        platform: z.enum(KNOWN_PLATFORMS),
      }),
    )
    .catch([]),
})
export type EditUserSchema = z.infer<typeof editUserSchema>
