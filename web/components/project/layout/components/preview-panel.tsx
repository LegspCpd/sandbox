"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { IDockviewPanelProps } from "dockview"
import { CopyIcon, ExternalLinkIcon, RotateCw } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export interface PreviewPanelParams {
  src: string
}

export function PreviewPanel(props: IDockviewPanelProps<PreviewPanelParams>) {
  const [iframeKey, setIframeKey] = useState(0)
  const { src } = props.params
  const refreshIframe = () => {
    setIframeKey((prev) => prev + 1)
  }

  // Refresh the preview when the URL changes
  useEffect(refreshIframe, [src])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-8 border border-b  px-2 bg-secondary flex items-center w-full justify-between">
        <div className="flex gap-2 flex-1 items-center">
          <PreviewButton
            label="刷新预览"
            onClick={refreshIframe}
            disabled={!src}
          >
            <RotateCw className="size-3" />
          </PreviewButton>
          <div className="flex-1">
            <span className="text-xs w-full line-clamp-1">{src}</span>
          </div>
        </div>
        <div className="flex space-x-1 items-center">
          <PreviewButton
            label="在新标签页打开"
            onClick={() => {
              window.open(src, "_blank")
            }}
            disabled={!src}
          >
            <ExternalLinkIcon className="size-3" />
          </PreviewButton>
          <PreviewButton
            label="复制预览链接"
            onClick={() => {
              navigator.clipboard.writeText(src).then(() => {
                toast.info("预览链接已复制到剪贴板")
              })
            }}
            disabled={!src}
          >
            <CopyIcon className="size-3" />
          </PreviewButton>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="w-full grow  overflow-hidden bg-secondary">
        {src ? (
          <iframe key={iframeKey} width="100%" height="100%" src={src} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 text-sm">
            <span className="text-muted-foreground/50 text-sm">没有可用的预览</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PreviewButton({
  children,
  disabled = false,
  onClick,
  label,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          disabled={disabled}
          onClick={onClick}
          className="h-6 w-6 ml-0.5 flex items-center justify-center translate-x-1 bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}
