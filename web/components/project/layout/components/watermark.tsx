import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useTerminal } from "@/context/TerminalContext"
import type { IWatermarkPanelProps } from "dockview"
import { Loader2, TerminalSquare } from "lucide-react"
import { useToggleChat, useToggleTerminal } from "../hooks/usePanelToggles"

export function MainWatermark(_props: IWatermarkPanelProps) {
  const toggleAIChat = useToggleChat()
  const toggleTerminal = useToggleTerminal()

  return (
    <div className="watermark space-y-4">
      <div className="letterpress" />
      <div className="flex flex-col gap-1 w-full">
        <button
          disabled
          aria-disabled="true"
          className="flex justify-between w-full items-center"
          style={{ opacity: 1 }}
        >
          <span className="text-xs text-muted-foreground">
            AI 编辑
          </span>
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>G</Kbd>
          </KbdGroup>
        </button>
        <button
          onClick={toggleAIChat}
          className="flex justify-between w-full items-center"
          style={{ opacity: 1 }}
        >
          <span className="text-xs text-muted-foreground">打开 AI 对话</span>
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>L</Kbd>
          </KbdGroup>
        </button>
        <button
          onClick={toggleTerminal}
          className="flex justify-between w-full items-center"
          style={{ opacity: 1 }}
        >
          <span className="text-xs text-muted-foreground">打开终端</span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>`</Kbd>
          </KbdGroup>
        </button>
      </div>
    </div>
  )
}
export function TerminalWatermark(_props: IWatermarkPanelProps) {
  const { creatingTerminal } = useTerminal()

  return (
    <div className="watermark">
      {creatingTerminal ? (
        <div className="w-full h-full flex items-center justify-center text-lg font-medium text-muted-foreground/50 select-none">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          正在创建终端...
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full">
          <div className="flex items-center justify-center text-lg font-medium text-muted-foreground/50 select-none">
            <TerminalSquare className="w-4 h-4 mr-2" />
            没有打开的终端。
          </div>
          <button
            disabled
            aria-disabled="true"
            className="flex justify-between w-full items-center"
            style={{ opacity: 1 }}
          >
            <span className="text-xs text-muted-foreground">新建终端</span>
            <KbdGroup>
              <Kbd>⌃</Kbd>
              <Kbd>⇧</Kbd>
              <Kbd>`</Kbd>
            </KbdGroup>
          </button>
        </div>
      )}
    </div>
  )
}
