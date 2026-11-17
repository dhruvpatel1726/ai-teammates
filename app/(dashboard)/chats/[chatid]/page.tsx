import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { getChat } from "@/chats/queries"
import { ChatHeader } from "@/components/chat-header"

export default async function Page({
  params,
}: {
  params: Promise<{ chatid: string }>
}) {
  await auth.protect()

  const { chatid } = await params
  const chat = await getChat(chatid)
  if (!chat) notFound()

  return <ChatHeader chat={chat} />
}
