import { xai } from "@ai-sdk/xai"
import { auth } from "@clerk/nextjs/server"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai"

import { getChat } from "@/chats/queries"

// Fast, non-reasoning model keeps the chat responsive. Swap for another xAI
// model ID (for example "grok-4.7") whenever you want.
const MODEL = "grok-4-1-fast-non-reasoning"

function buildInstructions(chat: Awaited<ReturnType<typeof getChat>>): string {
  if (!chat?.bot) return "You are a helpful AI assistant."

  const lines = [
    `You are ${chat.bot.name}, an AI teammate.`,
    `Your role: ${chat.bot.job}.`,
  ]
  if (chat.bot.instructions) {
    lines.push("Follow these instructions:", chat.bot.instructions)
  }
  return lines.join("\n")
}

export async function POST(req: Request) {
  await auth.protect()

  const { chatId, messages } = (await req.json()) as {
    chatId: string
    messages: UIMessage[]
  }
  if (typeof chatId !== "string" || !Array.isArray(messages)) {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  // The chat ID comes from the client, but ownership is checked server-side.
  const chat = await getChat(chatId)
  if (!chat) {
    return Response.json({ error: "Chat not found" }, { status: 404 })
  }

  const result = streamText({
    model: xai(MODEL),
    system: buildInstructions(chat),
    messages: await convertToModelMessages(messages),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  })
}
