"use server"

import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { auth } from "@clerk/nextjs/server"

import { getChat } from "@/chats/queries"
import type { teammateChat } from "@/trigger/chat"

const startSession =
  chat.createStartSessionAction<typeof teammateChat>("teammate-chat")
const loadTranscript = chat.createLoadTranscriptAction(defaultStorage)

async function requireOwnedChat(chatId: string) {
  await auth.protect()

  const ownedChat = await getChat(chatId)
  if (!ownedChat) throw new Error("Chat not found")
}

export async function startChatSession(
  params: Parameters<typeof startSession>[0]
) {
  await requireOwnedChat(params.chatId)
  // Forward the transport's client data so the first turn sees the same
  // per-message selection that later turns receive through metadata.
  return startSession(params)
}

export async function mintChatAccessToken(chatId: string) {
  await requireOwnedChat(chatId)

  return triggerAuth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  })
}

export async function loadChatTranscript(params: {
  chatId: string
  limit?: number
}) {
  await requireOwnedChat(params.chatId)
  return loadTranscript(params)
}
