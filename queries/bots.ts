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
  kind: "direct" | "group"
  avatarSeed: string
  botAvatars: string[]
  dateLabel: string
}

/** A bot the user can pick for a group chat or a chat composer. */
export type PickableBot = {
  id: string
  name: string
  job: string
  avatar: string
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
 * Direct chats keep a single avatar seed; group chats carry every member's
 * seed so the sidebar can render a grouped avatar and the "+N" count.
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

  const byChatId = new Map<string, UserChat>()

  for (const { chat, bot } of rows) {
    let entry = byChatId.get(chat.id)
    if (!entry) {
      entry = {
        id: chat.id,
        title:
          chat.name?.trim() ||
          (chat.kind === "group" ? "Group chat" : bot?.name || ""),
        kind: chat.kind,
        avatarSeed: bot?.avatar ?? chat.id,
        botAvatars: [],
        dateLabel: formatChatDate(chat.lastMessageAt),
      }
      byChatId.set(chat.id, entry)
    }
    if (bot) entry.botAvatars.push(bot.avatar)
  }

  return [...byChatId.values()]
}

/** Bots owned by the signed-in user, ordered by name for pickers. */
export async function getUserBots(): Promise<PickableBot[]> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) return []

  return db
    .select({
      id: bots.id,
      name: bots.name,
      job: bots.job,
      avatar: bots.avatar,
    })
    .from(bots)
    .where(eq(bots.userId, userId))
    .orderBy(asc(bots.name))
}
