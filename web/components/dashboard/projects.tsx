"use client"

import { deleteSandbox, updateSandbox } from "@/lib/api/actions"
import { Sandbox } from "@/lib/types"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import ProjectCard from "./projectCard"

export default function DashboardProjects({
  sandboxes,
  q,
}: {
  sandboxes: Sandbox[]
  q: string | null
}) {
  const [deletingId, setDeletingId] = useState<string>("")

  const onVisibilityChange = useMemo(
    () => async (sandbox: Pick<Sandbox, "id" | "name" | "visibility">) => {
      const newVisibility =
        sandbox.visibility === "public" ? "private" : "public"
      toast(`项目 ${sandbox.name} 已设为${newVisibility === "public" ? "公开" : "私有"}。`)
      await updateSandbox({
        id: sandbox.id,
        visibility: newVisibility,
      })
    },
    [],
  )

  const onDelete = useMemo(
    () => async (sandbox: Pick<Sandbox, "id" | "name">) => {
      setDeletingId(sandbox.id)
      toast(`项目 ${sandbox.name} 已删除。`)
      await deleteSandbox(sandbox.id)
    },
    [],
  )

  useEffect(() => {
    if (deletingId) {
      setDeletingId("")
    }
  }, [sandboxes])

  return (
    <div className="grow p-4 flex flex-col">
      <div className="text-xl font-medium mb-8">
        {q && q.length > 0 ? `搜索“${q}”的结果` : "我的项目"}
      </div>
      <div className="grow w-full ">
        {sandboxes.length > 0 ? (
          <div className="w-full grid lg:grid-cols-3 2xl:grid-cols-4 md:grid-cols-2 gap-4">
            {sandboxes.map((sandbox) => {
              if (q && q.length > 0) {
                if (!sandbox.name.toLowerCase().includes(q.toLowerCase())) {
                  return null
                }
              }
              return (
                <ProjectCard
                  key={sandbox.id}
                  onVisibilityChange={onVisibilityChange}
                  onDelete={onDelete}
                  deletingId={deletingId}
                  isAuthenticated
                  {...sandbox}
                  createdAt={new Date(sandbox.createdAt)}
                />
              )
            })}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            你还没有任何项目，创建一个开始吧！
          </div>
        )}
      </div>
    </div>
  )
}
