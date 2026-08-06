import { getUserProviderConfig } from "@/lib/ai/helpers"
import { createFileTools, defaultTools } from "@/lib/ai/tools"
import { createRouter } from "@/lib/api/create-app"
import type { FileTree } from "@gitwit/ai"
import { buildPrompt, createModel, mergeAiderDiff } from "@gitwit/ai"
import { Project } from "@gitwit/lib/services/Project"
import { templateConfigs } from "@gitwit/templates"
import { zValidator } from "@hono/zod-validator"
import { generateText, stepCountIs, streamText } from "ai"
import z from "zod"

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
})

const contextSchema = z
  .object({
    templateType: z.string().optional(),
    activeFileContent: z.string().optional(),
    fileTree: z.array(z.unknown()).optional(),
    contextContent: z.string().optional(),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    fileName: z.string().optional(),
  })
  .optional()

async function createUserModel(userId: string) {
  const providerConfig = await getUserProviderConfig(userId)
  return createModel(providerConfig)
}

export const aiRouter = createRouter()
  .post(
    "/stream-chat",
    zValidator(
      "json",
      z.object({
        messages: z.array(messageSchema),
        context: contextSchema,
      }),
    ),
    async (c) => {
      const { messages, context } = c.req.valid("json")
      const model = await createUserModel(c.get("user").id)

      const system = buildPrompt({
        mode: "chat",
        templateType: context?.templateType,
        templateConfigs,
        fileTree: context?.fileTree as FileTree[],
        activeFileContent: context?.activeFileContent,
        contextContent: context?.contextContent,
      })

      // Initialize project for file tools when projectId is available.
      // Only when running on a host with the local sandbox (backend server);
      // on Cloudflare there is no local filesystem, so file tools are skipped.
      let project: Project | null = null
      let fileTools = {}
      if (context?.projectId && process.env.LOCAL_SANDBOX === "true") {
        try {
          project = new Project(context.projectId)
          await project.initialize()
          fileTools = createFileTools(project)
        } catch (error) {
          console.error("Failed to initialize project for file tools:", error)
        }
      }

      const result = streamText({
        model,
        system,
        messages,
        tools: { ...defaultTools, ...fileTools },
        stopWhen: stepCountIs(5),
      })

      return result.toUIMessageStreamResponse()
    },
  )

  .post(
    "/process-edit",
    zValidator(
      "json",
      z.object({
        messages: z.array(messageSchema),
        context: contextSchema,
      }),
    ),
    async (c) => {
      const { messages, context } = c.req.valid("json")
      const model = await createUserModel(c.get("user").id)

      const system = buildPrompt({
        mode: "edit",
        fileName: context?.fileName,
        activeFileContent: context?.activeFileContent,
      })

      const result = await generateText({
        model,
        system,
        messages,
      })

      return c.json({ content: result.text })
    },
  )

  .post(
    "/merge-code",
    zValidator(
      "json",
      z.object({
        partialCode: z.string(),
        originalCode: z.string(),
        fileName: z.string(),
        projectId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { partialCode, originalCode, fileName } = c.req.valid("json")

      try {
        const mergedCode = mergeAiderDiff(originalCode, partialCode, fileName)
        return c.json({ mergedCode })
      } catch (error) {
        console.error("Code merge failed:", error)
        return c.json({ mergedCode: originalCode })
      }
    },
  )
