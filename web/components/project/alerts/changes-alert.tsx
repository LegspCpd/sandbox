import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAppStore } from "@/store/context"
export type AlertState = null | { type: "tab"; id: string }

export default function ChangesAlert() {
  const state = useAppStore((s) => s.unsavedAlert)
  const setState = useAppStore((s) => s.setUnsavedAlert)
  const onAccept = useAppStore((s) => s.removeTab)
  const toBeRemovedTab = useAppStore((s) => s.toBeRemovedTab)
  return (
    <AlertDialog open={state} onOpenChange={setState}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确定吗？</AlertDialogTitle>
          <AlertDialogDescription>
            此标签页有未保存的更改。你确定要关闭它吗？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              setState(false)
            }}
          >
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (toBeRemovedTab) {
                onAccept(toBeRemovedTab, true)
              }
            }}
          >
            确定
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
