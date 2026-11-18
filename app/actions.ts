"use server"

import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { auth } from "@clerk/nextjs/server"

import { getChat } from "@/chats/queries"
import { BILLABLE_FEATURES, PAID_FEATURE_MESSAGES } from "@/lib/billing"
import { getBillingPeriod } from "@/lib/billing-period"
import {
  MIN_TURN_RESERVE_MICROS,
  UsageLimitError,
  ensureUsagePeriod,
  hasBudget,
} from "@/lib/usage"
import type { teammateChat } from "@/trigger/chat"

const startSession =
  chat.createStartSessionAction<typeof teammateChat>("teammate-chat")
const loadTranscript = chat.createLoadTranscriptAction(defaultStorage)

async function requireOwnedChat(chatId: string) {
  const authObject = await auth.protect()

  const ownedChat = await getChat(chatId)
  if (!ownedChat) throw new Error("Chat not found")

  return authObject
}

function requirePaidFeature(
  has: Awaited<ReturnType<typeof requireOwnedChat>>["has"],
  feature: keyof typeof BILLABLE_FEATURES
) {
  if (!has({ feature: BILLABLE_FEATURES[feature] })) {
    throw new Error(PAID_FEATURE_MESSAGES[feature])
  }
}

async function requireAiBudget(userId: string) {
  const period = await getBillingPeriod(userId)
  await ensureUsagePeriod(userId, period)
  if (
    !(await hasBudget(
      userId,
      period,
      "aiTokens",
      MIN_TURN_RESERVE_MICROS
    ))
  ) {
    throw new UsageLimitError("aiTokens")
  }
}

export async function startChatSession(
  params: Parameters<typeof startSession>[0]
) {
  const { has, userId } = await requireOwnedChat(params.chatId)
  requirePaidFeature(has, "bots")
  await requireAiBudget(userId)
  // Forward the transport's client data so the first turn sees the same
  // per-message selection that later turns receive through metadata.
  return startSession(params)
}

export async function mintChatAccessToken(chatId: string) {
  const { has, userId } = await requireOwnedChat(chatId)
  requirePaidFeature(has, "bots")
  await requireAiBudget(userId)

  return triggerAuth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  })
}

/** Pre-flight check so the UI can show a quota toast before a turn is sent. */
export async function checkChatBudget(
  chatId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId } = await requireOwnedChat(chatId)
  try {
    await requireAiBudget(userId)
    return { ok: true }
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return { ok: false, message: error.message }
    }
    throw error
  }
}

export async function loadChatTranscript(params: {
  chatId: string
  limit?: number
}) {
  await requireOwnedChat(params.chatId)
  return loadTranscript(params)
}
