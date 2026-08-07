"use client"

import Avatar from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { useChangedFilesOptimistic } from "@/hooks/useChangedFilesOptimistic"
import { useGitHubLoadingStates } from "@/hooks/useGitHubLoadingStates"
import { githubRouter, type GithubUser } from "@/lib/api"
import type { ConflictFile, FileResolution } from "@/lib/types"
import { cn, createPopupTracker } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import {
  Download,
  GitBranch,
  GithubIcon,
  Loader2,
  MoreVertical,
  PackagePlus,
  RefreshCw,
} from "lucide-react"
import { useParams } from "next/navigation"
import * as React from "react"
import { useState } from "react"
import { toast } from "sonner"
import { ChangedFiles } from "./changed-files"
import { ConflictResolution } from "./conflict-resolution"

const REDIRECT_URI = "/loading"

export function GitHubSync({ userId: _userId }: { userId: string }) {
  const { id: projectId } = useParams<{ id: string }>()
  const [commitMessage, setCommitMessage] = React.useState("")
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [conflictFiles, setConflictFiles] = useState<ConflictFile[]>([])
  const [fileResolutions, setFileResolutions] = useState<FileResolution[]>([])
  const queryClient = useQueryClient()
  // Use global loading states
  const {
    isGettingAuthUrl,
    isLoggingIn,
    isSyncingToGithub,
    isCreatingRepo,
    isDeletingRepo,
    isPulling,
    isResolvingConflicts,
  } = useGitHubLoadingStates()
  const { clearChangedFiles } = useChangedFilesOptimistic()

  const { mutate: handleGithubLogin, reset: resetGithubLogin } =
    githubRouter.login.useMutation({
      onSuccess: () => {
        return queryClient.invalidateQueries(
          githubRouter.githubUser.getOptions(),
        )
      },
      onError: () => {
        toast.error("GitHub 登录失败")
      },
    })

  // Get GitHub user data
  const { data: githubUser } = githubRouter.githubUser.useQuery({
    select(data) {
      return data?.data
    },
  })

  // Get repository status
  const { data: repoStatus } = githubRouter.repoStatus.useQuery({
    variables: { projectId },
    select(data) {
      return data?.data
    },
  })

  // Calculate if we have a repository
  const hasRepo = repoStatus
    ? repoStatus.existsInDB && repoStatus.existsInGitHub
    : false

  const { mutate: getAuthUrl } = githubRouter.gethAuthUrl.useMutation({
    onSuccess({ data: { auth_url } }) {
      const tracker = createPopupTracker()

      return new Promise<{ code: string }>((resolve, reject) => {
        tracker.openPopup(auth_url, {
          onUrlChange(newUrl) {
            if (newUrl.includes(REDIRECT_URI)) {
              const urlParams = new URLSearchParams(new URL(newUrl).search)
              const code = urlParams.get("code")
              tracker.closePopup()

              if (code) {
                resolve({ code })
              } else {
                reject(new Error("No code received"))
              }
            }
          },
          onClose() {
            reject(new Error("Authentication window closed"))
          },
        })
      })
        .then(({ code }) => {
          handleGithubLogin({ code })
        })
        .catch((error) => {
          toast.error(
            error instanceof Error ? error.message : "认证失败",
          )
        })
    },
    onError: () => {
      toast.error("获取 GitHub 授权地址失败")
    },
  })
  const { mutate: syncToGithub } = githubRouter.createCommit.useMutation({
    onSuccess() {
      toast.success("提交创建成功")

      // Clear changed files after successful commit
      clearChangedFiles()
    },
    onError: (error: Error) => {
      toast.error(error.message || "创建提交失败")
    },
  })

  // Get changed files for validation - ONLY when repo exists and on initial load
  const {
    data: changedFilesData,
    isLoading: isChangedFilesLoading,
    isFetching: isChangedFilesFetching,
  } = githubRouter.getChangedFiles.useQuery({
    variables: { projectId },
    enabled: hasRepo && !!repoStatus?.existsInGitHub,
    staleTime: Infinity, // Don't refetch automatically - we'll manage this manually
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  // Handle sync with pull check
  const handleSyncToGithub = async () => {
    // Check if there are any changed files
    const changedFiles = changedFilesData?.data
    const hasChanges =
      changedFiles &&
      (changedFiles.modified?.length || 0) +
        (changedFiles.created?.length || 0) +
        (changedFiles.deleted?.length || 0) >
        0

    if (!hasChanges) {
      toast.error("没有可提交的文件")
      return
    }

    // Check if pull is needed before pushing
    const pullStatus = await githubRouter.checkPullStatus.fetcher({
      projectId,
    })
    if (pullStatus?.data?.needsPull) {
      toast.warning(
        "推送前请先从 GitHub 拉取最新更改，以免覆盖他人的工作。",
        {
          duration: 5000,
          action: {
            label: "立即拉取",
            onClick: () => handlePull(),
          },
        },
      )
      return
    }

    // Proceed with sync
    syncToGithub({
      projectId: projectId,
      message: commitMessage || "来自 GitWit 的更新",
    })
  }
  const { mutate: deleteRepo } = githubRouter.removeRepo.useMutation({
    onSuccess() {
      return queryClient
        .invalidateQueries(
          githubRouter.repoStatus.getOptions({
            projectId: projectId,
          }),
        )
        .then(() => {
          setCommitMessage("")
          toast.success("仓库删除成功")
        })
    },
    onError: (error: Error) => {
      toast.error(error.message || "删除仓库失败")
    },
  })
  const { mutate: handleCreateRepo } = githubRouter.createRepo.useMutation({
    onSuccess() {
      return queryClient
        .invalidateQueries(
          githubRouter.repoStatus.getOptions({
            projectId: projectId,
          }),
        )
        .then(() => {
          // Clear changed files optimistically after repo creation
          clearChangedFiles()
          toast.success("仓库创建成功")
        })
    },
    onError: (error: Error) => {
      toast.error(error.message || "创建仓库失败")
    },
  })

  // Pull-related queries and mutations
  const { data: pullStatus } = githubRouter.checkPullStatus.useQuery({
    variables: { projectId: projectId },
    select(data) {
      return data?.data
    },
    enabled: hasRepo, // Only check if repo exists
  })

  const { mutate: pullFromGithub } = githubRouter.pullFromGithub.useMutation({
    onSuccess(data) {
      const result = typeof data?.data === "object" ? data.data : undefined

      if (result?.conflicts && result.conflicts.length > 0) {
        // Show toast and modal for file-level conflict resolution
        toast.warning(
          `${result.conflicts.length} 个文件存在冲突，需要解决。`,
          {
            duration: 4000,
          },
        )
        setConflictFiles(result.conflicts)
        setShowConflictModal(true)
      } else if (result) {
        // No conflicts, show success message
        const messages = []
        if (result.newFiles.length > 0) {
          messages.push(
            `${result.newFiles.length} 个新文件已添加`,
          )
        }
        if (result.updatedFiles.length > 0) {
          messages.push(
            `${result.updatedFiles.length} 个文件已更新`,
          )
        }
        if (result.deletedFiles.length > 0) {
          messages.push(
            `${result.deletedFiles.length} 个文件已删除`,
          )
        }

        const message =
          messages.length > 0
            ? messages.join("，")
            : "拉取完成"
        toast.success(message)

        // Refresh file tree
        queryClient.invalidateQueries()
      } else {
        toast.success("拉取完成")
        queryClient.invalidateQueries()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "从 GitHub 拉取失败")
    },
  })

  const { mutate: resolveConflicts } =
    githubRouter.resolveConflicts.useMutation({
      onSuccess() {
        setFileResolutions([])
        setConflictFiles([])
        toast.success("冲突解决成功")
        queryClient.invalidateQueries()
      },
      onError: (error: Error) => {
        toast.error(error.message || "解决冲突失败")
      },
    })

  // Always enabled pull button
  const handlePull = async () => {
    try {
      // Always check if pull is needed
      const pullStatus = await githubRouter.checkPullStatus.fetcher({
        projectId,
      })

      if (!pullStatus?.data?.needsPull) {
        toast.info("已与 GitHub 保持同步")
        return
      }
      // If pull is needed, perform the pull using the mutation
      pullFromGithub({ projectId })
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "检查拉取状态失败",
      )
    }
  }

  // Modal for file-level conflict resolution
  const handleResolveConflicts = async () => {
    setShowConflictModal(false)
    resolveConflicts({
      projectId,
      conflictResolutions: fileResolutions,
    })
  }

  const handleFileResolutionChange = (
    fileIdx: number,
    resolution: "local" | "incoming",
  ) => {
    setFileResolutions((prev) => {
      const updated = [...prev]
      updated[fileIdx] = {
        path: conflictFiles[fileIdx].path,
        resolutions: [
          {
            conflictIndex: 0, // required by backend
            resolution,
            localContent: conflictFiles[fileIdx].localContent,
            incomingContent: conflictFiles[fileIdx].incomingContent,
          },
        ],
      }
      return updated
    })
  }

  const handleConflictCancel = () => {
    setShowConflictModal(false)
    setConflictFiles([])
    setFileResolutions([])
  }

  const content = React.useMemo(() => {
    if (!githubUser) {
      return (
        <>
          <p className="text-xs">
            将你的项目连接到 GitHub™️，让代码更安全、稳定，随时随地都能访问。
          </p>

          <Button
            variant="secondary"
            size="xs"
            className="mt-4 w-full font-normal"
            onClick={() => getAuthUrl()}
            disabled={isGettingAuthUrl || isLoggingIn}
          >
            {isLoggingIn ? (
              <Loader2 className="animate-spin mr-2 size-3" />
            ) : (
              <GithubIcon className="size-3 mr-2" />
            )}
            连接到 GitHub
          </Button>
        </>
      )
    } else {
      if (hasRepo) {
        return (
          <>
            <p className="text-xs">
              将你的项目连接到 GitHub，确保代码安全、有备份、随处可访问。
            </p>
            <div className="flex items-center justify-between bg-muted/50 px-2 py-1 rounded-sm min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <GithubUserButton {...githubUser} />
                <div className="min-w-0">
                  <a
                    href={`${githubUser.html_url}/${repoStatus?.repo?.name}`}
                    className="text-xs font-medium hover:underline truncate inline-block max-w-full align-bottom"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {repoStatus?.repo?.name}
                  </a>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <GitBranch className="size-2.5" />
                    <span className="text-[0.65rem]">main</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="smIcon" className="size-6">
                      <MoreVertical className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="">
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        deleteRepo({
                          projectId: projectId,
                        })
                      }}
                    >
                      {isDeletingRepo && (
                        <Loader2 className="animate-spin mr-2 size-3" />
                      )}
                      删除仓库
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <Textarea
                placeholder="在此输入提交信息..."
                className="!text-xs ring-inset"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
              <Button
                variant="outline"
                size="xs"
                className="w-full font-normal"
                onClick={handleSyncToGithub}
                disabled={
                  isSyncingToGithub ||
                  !changedFilesData?.data ||
                  (changedFilesData.data.modified?.length || 0) +
                    (changedFilesData.data.created?.length || 0) +
                    (changedFilesData.data.deleted?.length || 0) ===
                    0
                }
              >
                {isSyncingToGithub ? (
                  <Loader2 className="animate-spin mr-2 size-3" />
                ) : (
                  <RefreshCw className="size-3 mr-2" />
                )}
                Sync code
              </Button>
            </div>

            {/* Pull button */}
            <div className="flex gap-1 mt-2 min-w-0">
              <Button
                variant="outline"
                size="xs"
                className="w-full font-normal"
                onClick={handlePull}
                disabled={
                  isPulling ||
                  isResolvingConflicts ||
                  isChangedFilesLoading ||
                  isChangedFilesFetching
                }
              >
                {isPulling || isResolvingConflicts ? (
                  <Loader2 className="animate-spin mr-2 size-3" />
                ) : (
                  <Download className="size-3 mr-2" />
                )}
                从 GitHub 拉取
              </Button>
            </div>

            <ChangedFiles />
          </>
        )
      } else {
        return (
          <>
            <p className="text-xs">
              此沙箱还没有关联 GitHub 仓库。你可以创建一个仓库来与 GitHub 同步代码。
            </p>
            <div className="flex gap-1 mt-4">
              <GithubUserButton {...githubUser} rounded="sm" />
              <Button
                variant="secondary"
                size="xs"
                className="w-full font-normal"
                onClick={() => {
                  handleCreateRepo({
                    projectId: projectId,
                  })
                }}
                disabled={isCreatingRepo}
              >
                {isCreatingRepo ? (
                  <Loader2 className="animate-spin mr-2 size-3" />
                ) : (
                  <PackagePlus className="size-3 mr-2" />
                )}
                创建仓库
              </Button>
            </div>
          </>
        )
      }
    }
  }, [
    githubUser,
    isLoggingIn,
    hasRepo,
    isCreatingRepo,
    commitMessage,
    isSyncingToGithub,
    isDeletingRepo,
    handleGithubLogin,
    repoStatus,
    handleCreateRepo,
    syncToGithub,
    deleteRepo,
    getAuthUrl,
    handlePull,
    isPulling,
    pullStatus,
    handleSyncToGithub,
    isChangedFilesLoading,
    isChangedFilesFetching,
    clearChangedFiles,
  ])

  React.useEffect(() => {
    if (githubUser) {
      resetGithubLogin()
    }
  }, [githubUser, resetGithubLogin])

  return (
    <div className="styled-scrollbar hover-scrollbar flex-grow overflow-auto px-2 pt-0 pb-4 relative min-w-0">
      <div className="flex flex-col gap-3 w-full pt-2 min-w-0">
        <div className="flex items-center justify-between w-full min-w-0">
          <h2 className="font-medium">同步到 GitHub</h2>
        </div>
        {content}
      </div>

      {/* Conflict Resolution Modal */}
      <ConflictResolution
        conflictFiles={conflictFiles}
        fileResolutions={fileResolutions}
        onFileResolutionChange={handleFileResolutionChange}
        onResolve={handleResolveConflicts}
        onCancel={handleConflictCancel}
        open={showConflictModal}
        pendingPull={isResolvingConflicts}
      />
    </div>
  )
}

interface GithubUserButtonProps {
  rounded?: "full" | "sm"
}

function GithubUserButton({
  rounded,
  ...githubUser
}: GithubUserButtonProps & GithubUser) {
  const queryClient = useQueryClient()
  const { isLoggingOut } = useGitHubLoadingStates()
  const { mutate: handleGithubLogout } = githubRouter.logout.useMutation({
    onSuccess: () => {
      return queryClient.invalidateQueries(githubRouter.githubUser.getOptions())
    },
    onError: () => {
      toast.error("从 GitHub 退出登录失败")
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="smIcon" className="size-6">
          <Avatar
            className={cn("size-6", rounded === "sm" && "rounded-sm")}
            name={githubUser.name ?? ""}
            avatarUrl={githubUser.avatar_url}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" side="bottom" align="start">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Avatar
              className="size-6"
              name={githubUser.name ?? ""}
              avatarUrl={githubUser.avatar_url}
            />
            <div className="grid flex-1 text-left text-sm leading-tight ml-2">
              <span className="truncate font-semibold text-xs">
                {githubUser.name}
              </span>
              <span className="truncate text-[0.6rem]">
                @{githubUser.login}
              </span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleGithubLogout()
                }}
              >
                {isLoggingOut && (
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                )}
                Logout
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={githubUser.html_url} target="_blank" rel="noreferrer">
                  View profile
                </a>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
