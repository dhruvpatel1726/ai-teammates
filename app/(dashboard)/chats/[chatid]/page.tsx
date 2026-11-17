import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { getChat } from "@/chats/queries"
import { ChatHeader } from "@/components/chat-header"
import { ChatPanel } from "@/components/chat-panel"
import {
  ChatSidePanel,
  ChatSidePanelProvider,
} from "@/components/chat-side-panel"
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

export default async function Page({
  params,
}: {
  params: Promise<{ chatid: string }>
}) {
  await auth.protect()

  const { chatid } = await params
  const chat = await getChat(chatid)
  if (!chat) notFound()

  return (
    <ChatSidePanelProvider>
      <ResizablePanelGroup orientation="horizontal" className="h-svh w-full">
        <ResizablePanel className="flex flex-col" style={{ overflow: "hidden" }}>
          <ChatHeader chat={chat} />
          <ChatPanel chatId={chat.id} kind={chat.kind} bots={chat.bots} />
        </ResizablePanel>
        <ChatSidePanel />
      </ResizablePanelGroup>
    </ChatSidePanelProvider>
  )
}
