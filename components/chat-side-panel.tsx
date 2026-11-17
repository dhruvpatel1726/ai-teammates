"use client"

import { createContext, useCallback, useContext, useState } from "react"
import type { ReactNode } from "react"

import {
  ResizableHandle,
  ResizablePanel,
} from "@/components/ui/resizable"

type ChatSidePanelContextValue = {
  isOpen: boolean
  toggle: () => void
}

const ChatSidePanelContext = createContext<ChatSidePanelContextValue | null>(
  null
)

/** Shares the visibility of the chat page's optional right-hand panel. */
export function ChatSidePanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const toggle = useCallback(() => setIsOpen((open) => !open), [])

  return (
    <ChatSidePanelContext.Provider value={{ isOpen, toggle }}>
      {children}
    </ChatSidePanelContext.Provider>
  )
}

export function useChatSidePanel() {
  const context = useContext(ChatSidePanelContext)
  if (!context) {
    throw new Error("useChatSidePanel must be used within a ChatSidePanelProvider")
  }
  return context
}

/** The toggled, intentionally empty panel rendered beside the chat. */
export function ChatSidePanel() {
  const { isOpen } = useChatSidePanel()

  if (!isOpen) return null

  return (
    <>
      <ResizableHandle />
      <ResizablePanel defaultSize="30%" minSize="20%" />
    </>
  )
}
