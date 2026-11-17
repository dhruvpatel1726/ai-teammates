import "server-only"

import { auth } from "@clerk/nextjs/server"

import { findChatDetails, type ChatDetails } from "./lookup"

export type { ChatDetails }

/**
 * Load a single chat for the signed-in Clerk user.
 *
 * The user ID is part of both the chat and bot filters so a guessed chat ID
 * can never expose another user's conversation.
 */
export async function getChat(chatId: string): Promise<ChatDetails | null> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) return null

  return findChatDetails(chatId, userId)
}
