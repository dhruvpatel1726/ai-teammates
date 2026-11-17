import { xai } from "@ai-sdk/xai"
import { chat } from "@trigger.dev/sdk/ai"

import { findChatDetails } from "@/chats/lookup"

// Fast, non-reasoning model keeps the chat responsive.
const MODEL = "grok-4-1-fast-non-reasoning"

function buildInstructions(
  details: Awaited<ReturnType<typeof findChatDetails>>
): string {
  if (!details?.bot) return "You are a helpful AI assistant."

  const lines = [
    `You are ${details.bot.name}, an AI teammate.`,
    `Your role: ${details.bot.job}.`,
  ]
  if (details.bot.instructions) {
    lines.push("Follow these instructions:", details.bot.instructions)
  }
  return lines.join("\n")
}

export const teammateChat = chat.agent({
  id: "teammate-chat",
  run: async ({ chatId, messages, signal, streamText }) => {
    const details = await findChatDetails(chatId)

    return streamText({
      model: xai(MODEL),
      system: buildInstructions(details),
      messages,
      abortSignal: signal,
    })
  },
})
