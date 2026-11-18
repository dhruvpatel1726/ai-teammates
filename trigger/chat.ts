import { xai } from "@ai-sdk/xai"
import { chat } from "@trigger.dev/sdk/ai"
import { isStepCount, tool, type ToolSet } from "ai"
import { z } from "zod"

import { findChatDetails, type ChatBot } from "@/chats/lookup"
import {
  UsageLimitError,
  chargeUsage,
  estimateTokenCostUsd,
  getActiveUsagePeriod,
  getUsageSummary,
} from "@/lib/usage"

// Fast, non-reasoning model keeps the chat responsive.
const MODEL = "grok-4-1-fast-non-reasoning"
const HANDOFF_TOOL = "handoff"

type HandoffResult = {
  ok: boolean
  botId?: string
  botName?: string
  reason?: string
  error?: string
}

function identityLines(bot: ChatBot): string[] {
  const lines = [
    `You are ${bot.name}, an AI teammate.`,
    `Your role: ${bot.job}.`,
  ]
  if (bot.instructions) {
    lines.push("Follow these instructions:", bot.instructions)
  }
  return lines
}

/** Direct chats only need the bot's own identity and role. */
function directInstructions(bot: ChatBot | null): string {
  return bot
    ? identityLines(bot).join("\n")
    : "You are a helpful AI assistant."
}

/**
 * Group chats explain the shared conversation, name the teammates (with the
 * IDs the handoff tool expects), and spell out the one tool available.
 */
function groupInstructions(
  bot: ChatBot,
  teammates: ChatBot[],
  afterHandoff: boolean
): string {
  const lines = [
    ...identityLines(bot),
    "",
    "You are in a group chat with several AI teammates. The user is talking to the group, and you are the bot currently answering this turn.",
    "Answer as yourself only and never speak for a teammate unless a handoff has assigned this turn to you.",
  ]

  if (teammates.length > 0) {
    lines.push(
      "",
      "Your teammates in this chat:",
      ...teammates.map(
        (teammate) => `- ${teammate.name} (id: ${teammate.id}) — ${teammate.job}`
      )
    )
  }

  if (afterHandoff) {
    lines.push(
      "",
      "This turn was handed off to you. Answer the user directly as yourself now, and do not call the handoff tool again."
    )
  } else {
    lines.push(
      "",
      "You have one tool, handoff. Call it when the user's request clearly fits another teammate better than you: pass that teammate's id (from the list above) and a short reason. If you call handoff, write no answer yourself in that step — the response will be generated as the teammate you chose. If your role fits the request, answer directly without calling it."
    )
  }

  return lines.join("\n")
}

function respondingBotOf(
  details: Awaited<ReturnType<typeof findChatDetails>>,
  botId?: string
): ChatBot | null {
  if (!details) return null
  if (details.kind !== "group") return details.bot
  return (
    details.bots.find((bot) => bot.id === botId) ?? details.bots[0] ?? null
  )
}

function buildInstructions(
  details: Awaited<ReturnType<typeof findChatDetails>>,
  botId?: string
): string {
  if (!details) return "You are a helpful AI assistant."
  if (details.kind !== "group" || details.bots.length < 2) {
    return directInstructions(details.bot)
  }

  const responding = respondingBotOf(details, botId)
  if (!responding) return "You are a helpful AI assistant."

  return groupInstructions(
    responding,
    details.bots.filter((bot) => bot.id !== responding.id),
    false
  )
}

/**
 * Handoff is only exposed in group chats with at least two bots, and the
 * current bot is never offered as a target. Declaring the set on the agent
 * keeps tool results stable when prior turns are re-converted to model
 * messages.
 */
const tools = async ({
  chatId,
  clientData,
}: {
  chatId: string
  clientData?: { botId?: string }
}): Promise<ToolSet> => {
  const details = await findChatDetails(chatId)
  if (!details || details.kind !== "group" || details.bots.length < 2) {
    return {}
  }

  const respondingId = respondingBotOf(details, clientData?.botId)?.id
  const candidates = details.bots.filter((bot) => bot.id !== respondingId)
  if (candidates.length === 0) return {}

  return {
    [HANDOFF_TOOL]: tool({
      description:
        "Hand the user's current request to another teammate in this group chat when that teammate is better suited to answer it. Do not answer yourself in the same step.",
      inputSchema: z.object({
        botId: z.string().describe("The id of the teammate taking over"),
        reason: z
          .string()
          .describe("Why that teammate is better suited for this request"),
      }),
      execute: async ({ botId, reason }): Promise<HandoffResult> => {
        const target = candidates.find((bot) => bot.id === botId)
        if (!target) {
          return { ok: false, error: "That bot is not available for handoff." }
        }
        return {
          ok: true,
          botId: target.id,
          botName: target.name,
          reason,
        }
      },
    }),
  }
}

export const teammateChat = chat.agent({
  id: "teammate-chat",
  // The UI picks one bot per turn and sends its ID through transport metadata.
  clientDataSchema: z.object({ botId: z.string().optional() }),
  tools,
  run: async ({ chatId, messages, tools, signal, streamText, clientData }) => {
    const details = await findChatDetails(chatId)
    if (details) {
      // Every turn re-checks the ledger — a session can stay open long after
      // its budget was exhausted by earlier turns.
      const period = await getActiveUsagePeriod(details.userId)
      const summary = await getUsageSummary(details.userId, period)
      if (summary.buckets.aiTokens.remainingMicros <= 0) {
        throw new UsageLimitError("aiTokens")
      }
    }

    const isGroup = details?.kind === "group" && details.bots.length >= 2
    const respondingBotId = respondingBotOf(details, clientData?.botId)?.id

    return streamText({
      model: xai(MODEL),
      instructions: buildInstructions(details, respondingBotId),
      messages,
      tools,
      abortSignal: signal,
      stopWhen: isStepCount(3),
      prepareStep: ({ steps }) => {
        if (!isGroup || !details) return {}

        const handoff = steps
          .flatMap((step) => step.toolResults ?? [])
          .find((result) => result.toolName === HANDOFF_TOOL)
        if (!handoff) return {}

        const result = handoff.output as HandoffResult | undefined
        const target = result?.ok
          ? details.bots.find((bot) => bot.id === result.botId)
          : undefined
        if (!target) return {}

        // Switch the persona for the rest of this turn and prevent a chain of
        // handoffs: the chosen bot answers now.
        return {
          instructions: groupInstructions(
            target,
            details.bots.filter((bot) => bot.id !== target.id),
            true
          ),
          activeTools: [],
        }
      },
    })
  },
  onTurnComplete: async ({ chatId, usage, error }) => {
    if (error || !usage) return

    // The worker has no Clerk request context, so ownership comes from the
    // trusted chat row rather than from client-supplied data.
    const details = await findChatDetails(chatId)
    if (!details) return

    const period = await getActiveUsagePeriod(details.userId)
    await chargeUsage({
      userId: details.userId,
      period,
      category: "aiTokens",
      costUsd: estimateTokenCostUsd(MODEL, usage),
      source: "chat",
      referenceId: chatId,
      tokens: {
        inputTokens: usage.inputTokens ?? undefined,
        outputTokens: usage.outputTokens ?? undefined,
      },
    })
  },
})
