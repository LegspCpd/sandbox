"use client"

import React, { createContext, useContext, useEffect, useRef, useState } from "react"
import { io, Socket } from "socket.io-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface SocketContextType {
  socket: Socket | null
  isReady: boolean
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export const SocketProvider: React.FC<{
  children: React.ReactNode
  token: string | null
  userId: string
  sandboxId: string
}> = ({ children, token, userId, sandboxId }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [password, setPassword] = useState("")
  const passwordRef = useRef<string>("")

  // Whether the terminal password is required. Controlled via a Vercel
  // build-time env var; when "1", the user must enter the terminal password
  // (CMD-PASS) before the socket connection is established.
  const passwordEnabled =
    process.env.NEXT_PUBLIC_TERMINAL_PASSWORD_ENABLED === "1"

  const connectRef = useRef<(pwd?: string) => void>(() => {})

  useEffect(() => {
    const connect = (pwd?: string) => {
      const newSocket = io(
        `${process.env.NEXT_PUBLIC_SERVER_URL}?userId=${userId}&sandboxId=${sandboxId}`,
        {
          auth: {
            token,
            sandboxId,
            ...(pwd ? { password: pwd } : {}),
          },
        },
      )

      newSocket.on("ready", () => {
        setIsReady(true)
        // Defer so TerminalContext's useEffect can register listeners first
        setTimeout(() => newSocket.emit("getInitialState"), 0)
      })

      newSocket.on("disconnect", () => {
        setIsReady(false)
      })

      newSocket.on("connect_error", (err) => {
        setIsReady(false)
        newSocket.disconnect()
        // If the terminal password is enabled and the connection failed,
        // it is most likely a wrong password — ask again.
        if (passwordEnabled && err?.message?.includes("终端密码")) {
          setPassword("")
          setPasswordDialogOpen(true)
        }
      })

      setSocket(newSocket)
    }
    connectRef.current = connect

    if (passwordEnabled) {
      // Password is required — ask the user first.
      setPasswordDialogOpen(true)
    } else {
      connect()
    }

    return () => {
      setSocket((s) => {
        s?.disconnect()
        return null
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordEnabled])

  const handlePasswordSubmit = () => {
    const pwd = password.trim()
    if (!pwd) {
      toast.error("请输入终端密码")
      return
    }
    passwordRef.current = pwd
    setPasswordDialogOpen(false)
    setPassword("")
    connectRef.current(pwd)
  }

  const value = {
    socket,
    isReady,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>终端密码（CMD-PASS）</DialogTitle>
            <DialogDescription>
              连接远程终端需要输入密码。请输入管理员设置的终端访问密码。
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              handlePasswordSubmit()
            }}
          >
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入终端密码"
            />
            <Button type="submit" className="w-full">
              连接
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </SocketContext.Provider>
  )
}

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider")
  }
  return context
}
