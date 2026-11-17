import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { getChat } from "@/chats/queries"
import { ChatHeader } from "@/components/chat-header"
import { ChatPanel } from "@/components/chat-panel"

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
    <div className="flex h-svh min-h-0 flex-col">
      <ChatHeader chat={chat} />
      <ChatPanel chatId={chat.id} botName={chat.bot?.name} />
    </div>
  )
}
