import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, desc, eq } from "drizzle-orm"
import {
  differenceInCalendarDays,
  format,
  isToday,
  isYesterday,
} from "date-fns"

import { db } from "@/db"
import { bots, chatMembers, chats } from "@/db/schema"

export type UserChat = {
  id: string
  title: string
  avatarSeed: string
  dateLabel: string
}

function formatChatDate(date: Date): string {
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return "Yesterday"
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, "EEE")
  return format(date, "MMM d")
}

/**
 * Chats belonging to the signed-in Clerk user, newest activity first.
 *
 * Each row is joined to its first-joined bot. Group chats are treated the same
 * for now: their avatar and fallback title come from that first bot.
 */
export async function getUserChats(): Promise<UserChat[]> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) return []

  const rows = await db
    .select({ chat: chats, bot: bots })
    .from(chats)
    .leftJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .leftJoin(
      bots,
      and(eq(bots.id, chatMembers.botId), eq(bots.userId, userId))
    )
    .where(eq(chats.userId, userId))
    .orderBy(
      desc(chats.lastMessageAt),
      asc(chatMembers.joinedAt),
      asc(chatMembers.botId)
    )

  const seen = new Set<string>()
  const result: UserChat[] = []

  for (const { chat, bot } of rows) {
    if (seen.has(chat.id)) continue
    seen.add(chat.id)

    result.push({
      id: chat.id,
      title: chat.name?.trim() || bot?.name || "",
      avatarSeed: bot?.avatar ?? chat.id,
      dateLabel: formatChatDate(chat.lastMessageAt),
    })
  }

  return result
}
