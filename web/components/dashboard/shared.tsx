import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { projectTemplates } from "@gitwit/templates"
import { ChevronRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import Avatar from "../ui/avatar"
import Button from "../ui/customButton"

export default function DashboardSharedWithMe({
  shared,
}: {
  shared: {
    id: string
    name: string
    type: string
    author: string
    authorAvatarUrl: string
    sharedOn: string
  }[]
}) {
  return (
    <div className="grow p-4 flex flex-col">
      <div className="text-xl font-medium mb-8">与我共享</div>
      {shared.length > 0 ? (
        <div className="grow w-full">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-background">
                <TableHead>沙箱名称</TableHead>
                <TableHead>共享者</TableHead>
                <TableHead>共享时间</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shared.map((sandbox) => (
                <TableRow>
                  <TableCell>
                    <div className="font-medium flex items-center">
                      <Image
                        alt=""
                        src={
                          projectTemplates.find((p) => p.id === sandbox.type)
                            ?.icon ?? "/project-icons/node.svg"
                        }
                        width={20}
                        height={20}
                        className="mr-2"
                      />
                      {sandbox.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Avatar
                        name={sandbox.author}
                        avatarUrl={sandbox.authorAvatarUrl}
                        className="mr-2"
                      />
                      {sandbox.author}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(sandbox.sharedOn).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/code/${sandbox.id}`}>
                      <Button>
                        打开 <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-muted-foreground text-sm">
          这里还没有共享的沙箱。让朋友分享一个给你，体验实时协作吧！
        </div>
      )}
    </div>
  )
}
