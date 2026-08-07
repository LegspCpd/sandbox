import NewProjectModal from "@/components/dashboard/new-project"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { PlusCircle } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

export default function EmptyState({
  type,
  isOwnProfile,
}: {
  type: "public" | "private"
  isOwnProfile: boolean
}) {
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false)

  const text = useMemo(() => {
    let title = ""
    let description = ""

    switch (type) {
      case "public":
        title = "还没有公开沙箱"
        description = isOwnProfile
          ? "创建你的第一个公开沙箱，向全世界分享你的作品吧！"
          : "该用户没有公开沙箱"
        break

      case "private":
        title = "还没有私有沙箱"
        description = isOwnProfile
          ? "创建你的第一个私有沙箱，开始你的个人项目吧！"
          : "该用户没有私有沙箱"
        break

      default:
        title = "暂无沙箱"
        description = "这里还没有内容。"
    }

    return { title, description }
  }, [type, isOwnProfile])

  const openModal = useCallback(() => setNewProjectModalOpen(true), [])
  return (
    <>
      <Card className="flex flex-col items-center justify-center p-6 text-center h-[300px]">
        <PlusCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <CardTitle className="text-xl mb-2">{text.title}</CardTitle>
        <CardDescription className="mb-4">{text.description}</CardDescription>
        {isOwnProfile && (
          <Button onClick={openModal}>
            <PlusCircle className="h-4 w-4 mr-2" />
            创建沙箱
          </Button>
        )}
      </Card>
      <NewProjectModal
        open={newProjectModalOpen}
        setOpen={setNewProjectModalOpen}
      />
    </>
  )
}
