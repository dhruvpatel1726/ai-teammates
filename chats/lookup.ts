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
 * Load a chat by ID. Callers that talk to the browser must authorize the
 * signed-in user themselves; the Trigger.dev worker uses this without a
 * request context.
 */
export async function findChatDetails(
  chatId: string,
  userId?: string
): Promise<ChatDetails | null> {
  const [row] = await db
    .select({ chat: chats, bot: bots })
    .from(chats)
    .leftJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .leftJoin(
      bots,
      and(
        eq(bots.id, chatMembers.botId),
        userId ? eq(bots.userId, userId) : undefined
      )
    )
    .where(
      userId
        ? and(eq(chats.id, chatId), eq(chats.userId, userId))
        : eq(chats.id, chatId)
    )
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
