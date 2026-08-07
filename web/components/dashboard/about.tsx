"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function AboutModal({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>帮助与支持</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* <div className="text-sm text-muted-foreground">
            Sandbox is an open-source cloud-based code editing environment with
            custom AI code autocompletion and real-time collaboration.
          </div> */}
          <div className="text-sm text-muted-foreground">
            通过我们的 Discord 社区或到 GitHub 提交问题来获取帮助与支持：
          </div>
          <div className="space-y-2">
            <div className="text-sm">
              <a
                href="https://discord.gitwit.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                加入我们的 Discord 社区 →
              </a>
            </div>
            <div className="text-sm">
              <a
                href="https://github.com/jamesmurdza/gitwit/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                到 GitHub 提交问题 →
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
