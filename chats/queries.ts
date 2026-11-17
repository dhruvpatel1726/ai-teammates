import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { bots, chatMembers, chats } from "@/db/schema"

/** A chat together with the first bot that joined it. */
export type ChatDetails = {
  id: string
  title: string
  bot: {
    id: string
    name: string
    job: string
    instructions: string | null
    avatar: string
  } | null
}

/**
 * Load a single chat for the signed-in Clerk user.
 *
 * The user ID is part of both the chat and bot filters so a guessed chat ID
 * can never expose another user's conversation. Group chats currently use the
 * first-joined bot for their avatar and details.
 */
export async function getChat(chatId: string): Promise<ChatDetails | null> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) return null

  const [row] = await db
    .select({ chat: chats, bot: bots })
    .from(chats)
    .leftJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .leftJoin(
      bots,
      and(eq(bots.id, chatMembers.botId), eq(bots.userId, userId))
    )
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .orderBy(asc(chatMembers.joinedAt), asc(chatMembers.botId))
    .limit(1)

  if (!row) return null

  return {
    id: row.chat.id,
    title: row.chat.name?.trim() || row.bot?.name || "",
    bot: row.bot
      ? {
          id: row.bot.id,
          name: row.bot.name,
          job: row.bot.job,
          instructions: row.bot.instructions,
          avatar: row.bot.avatar,
        }
      : null,
  }
}
