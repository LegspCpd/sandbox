"use client"

import ProviderCard from "@/components/dashboard/settings/api-keys/provider-card"
import { Accordion } from "@/components/ui/accordion"
import { PROVIDERS, Provider, ProviderConfig } from "@/lib/types"
import { apiClient } from "@/server/client"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type ConfiguredKeys = {
  hasAnthropic: boolean
  anthropicModel?: string
  hasOpenai: boolean
  openaiModel?: string
  hasOpenrouter: boolean
  openrouterModel?: string
  hasAws: boolean
  awsModel?: string
  encryptionAvailable?: boolean
}

export default function ApiKeysSettings() {
  const [configuredKeys, setConfiguredKeys] = useState<ConfiguredKeys>({
    hasAnthropic: false,
    hasOpenai: false,
    hasOpenrouter: false,
    hasAws: false,
    encryptionAvailable: true,
  })

  useEffect(() => {
    loadApiKeysStatus()
  }, [])

  const loadApiKeysStatus = async () => {
    try {
      const response = await apiClient.user["api-keys"].$get()
      if (response.ok) {
        const data = await response.json()
        setConfiguredKeys(data)
      }
    } catch (error) {
      console.error("Failed to load API keys status:", error)
      toast.error("加载 API 密钥配置失败")
    }
  }

  // Show message if encryption is not available
  if (configuredKeys.encryptionAvailable === false) {
    return (
      <div className="max-w-4xl">
        <div className="border rounded-lg p-6 bg-muted/30">
          <h3 className="font-semibold mb-2">自定义 API 密钥不可用</h3>
          <p className="text-sm text-muted-foreground mb-4">
            自定义 API 密钥功能需要在服务器上配置{" "}
            <code className="px-1.5 py-0.5 bg-muted rounded text-xs">
              ENCRYPTION_KEY
            </code>{" "}
            环境变量。
          </p>
          <p className="text-sm text-muted-foreground">
            要启用此功能，请在服务器的环境变量中设置{" "}
            <code className="px-1.5 py-0.5 bg-muted rounded text-xs">
              ENCRYPTION_KEY
            </code>{" "}
            并重启应用。
          </p>
          <details className="mt-4">
            <summary className="text-sm font-medium cursor-pointer">
              如何生成加密密钥
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-sm text-muted-foreground">
                运行以下任一命令来生成安全密钥：
              </p>
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                node -e
                &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
              </pre>
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                openssl rand -base64 32
              </pre>
            </div>
          </details>
        </div>
      </div>
    )
  }

  return (
    <Accordion type="multiple" className="space-y-3 max-w-4xl">
      {(Object.entries(PROVIDERS) as [Provider, ProviderConfig][]).map(
        ([provider, config]) => {
          const isConfigured = (
            provider === "aws"
              ? configuredKeys.hasAws
              : configuredKeys[
                  `has${
                    provider.charAt(0).toLocaleUpperCase() + provider.slice(1)
                  }` as keyof typeof configuredKeys
                ]
          ) as boolean

          const configuredModel =
            provider === "aws"
              ? configuredKeys.awsModel
              : configuredKeys[
                  `${provider}Model` as keyof typeof configuredKeys
                ]

          return (
            <ProviderCard
              key={provider}
              provider={provider}
              config={config}
              isConfigured={isConfigured}
              configuredModel={configuredModel as string | undefined}
              onUpdate={loadApiKeysStatus}
            />
          )
        },
      )}
    </Accordion>
  )
}
