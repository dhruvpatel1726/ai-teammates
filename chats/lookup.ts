import { and, asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { bots, chatMembers, chats } from "@/db/schema"

/** A bot that belongs to a chat, in the shape the UI and agent both need. */
export type ChatBot = {
  id: string
  name: string
  job: string
  instructions: string | null
  avatar: string
}

/** A chat together with every bot that joined it, in join order. */
export type ChatDetails = {
  id: string
  userId: string
  title: string
  kind: "direct" | "group"
  bot: ChatBot | null
  bots: ChatBot[]
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
  const rows = await db
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

  const chat = rows[0]?.chat
  if (!chat) return null

  const allBots: ChatBot[] = rows.flatMap(({ bot }) =>
    bot
      ? [
          {
            id: bot.id,
            name: bot.name,
            job: bot.job,
            instructions: bot.instructions,
            avatar: bot.avatar,
          },
        ]
      : []
  )

  return {
    id: chat.id,
    userId: chat.userId,
    kind: chat.kind,
    title:
      chat.name?.trim() ||
      allBots[0]?.name ||
      (chat.kind === "group" ? "Group chat" : ""),
    bot: allBots[0] ?? null,
    bots: allBots,
  }
}
