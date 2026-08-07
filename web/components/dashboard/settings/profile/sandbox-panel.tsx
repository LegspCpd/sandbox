import ProjectCard from "@/components/dashboard/projectCard"
import EmptyState from "@/components/dashboard/settings/profile/empty-state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { deleteSandbox, updateSandbox } from "@/lib/api/actions"
import { SandboxWithLiked } from "@/lib/types"
import { Fragment, useMemo, useState } from "react"
import { toast } from "sonner"

export default function SandboxesPanel({
  publicSandboxes,
  privateSandboxes,
  isOwnProfile,
}: {
  publicSandboxes: SandboxWithLiked[]
  privateSandboxes: SandboxWithLiked[]
  isOwnProfile: boolean
}) {
  const [deletingId, setDeletingId] = useState<string>("")
  const hasPublicSandboxes = publicSandboxes.length > 0
  const hasPrivateSandboxes = privateSandboxes.length > 0

  const onVisibilityChange = useMemo(
    () =>
      async (sandbox: Pick<SandboxWithLiked, "id" | "name" | "visibility">) => {
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
    () => async (sandbox: Pick<SandboxWithLiked, "id" | "name">) => {
      setDeletingId(sandbox.id)
      toast(`项目 ${sandbox.name} 已删除。`)
      await deleteSandbox(sandbox.id)
      setDeletingId("")
    },
    [],
  )
  if (!isOwnProfile) {
    return (
      <div className="">
        {hasPublicSandboxes ? (
          <>
            <h2 className="font-semibold text-xl mb-4">沙箱</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {publicSandboxes.map((sandbox) => {
                return (
                  <Fragment key={sandbox.id}>
                    {isOwnProfile ? (
                      <ProjectCard
                        onVisibilityChange={onVisibilityChange}
                        onDelete={onDelete}
                        deletingId={deletingId}
                        isAuthenticated
                        {...sandbox}
                        createdAt={new Date(sandbox.createdAt)}
                      />
                    ) : (
                      <ProjectCard
                        isAuthenticated={false}
                        {...sandbox}
                        createdAt={new Date(sandbox.createdAt)}
                      />
                    )}
                  </Fragment>
                )
              })}
            </div>
          </>
        ) : (
          <EmptyState type="public" isOwnProfile={isOwnProfile} />
        )}
      </div>
    )
  }
  return (
    <Tabs defaultValue="public">
      <TabsList className="mb-4">
        <TabsTrigger value="public">公开</TabsTrigger>
        <TabsTrigger value="private">私有</TabsTrigger>
      </TabsList>
      <TabsContent value="public">
        {hasPublicSandboxes ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {publicSandboxes.map((sandbox) => {
              return (
                <Fragment key={sandbox.id}>
                  {isOwnProfile ? (
                    <ProjectCard
                      onVisibilityChange={onVisibilityChange}
                      onDelete={onDelete}
                      deletingId={deletingId}
                      isAuthenticated
                      {...sandbox}
                      createdAt={new Date(sandbox.createdAt)}
                    />
                  ) : (
                    <ProjectCard
                      isAuthenticated={false}
                      {...sandbox}
                      createdAt={new Date(sandbox.createdAt)}
                    />
                  )}
                </Fragment>
              )
            })}
          </div>
        ) : (
          <EmptyState type="public" isOwnProfile={isOwnProfile} />
        )}
      </TabsContent>
      <TabsContent value="private">
        {hasPrivateSandboxes ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {privateSandboxes.map((sandbox) => (
              <ProjectCard
                key={sandbox.id}
                onVisibilityChange={onVisibilityChange}
                onDelete={onDelete}
                deletingId={deletingId}
                isAuthenticated
                {...sandbox}
                createdAt={new Date(sandbox.createdAt)}
              />
            ))}
          </div>
        ) : (
          <EmptyState type="private" isOwnProfile={isOwnProfile} />
        )}
      </TabsContent>
    </Tabs>
  )
}
