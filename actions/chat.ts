"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import {
  bots,
  chatMembers,
  chats,
  createGroupChatSchema,
  type CreateGroupChatInput,
} from "@/db/schema"
import { getUserChats } from "@/queries/bots"

/** Refetch the signed-in user's chats on demand, e.g. after creating a bot. */
export async function refreshUserChats() {
  return getUserChats()
}

export type CreateGroupChatResult =
  | { chatId: string; error: null }
  | { chatId: null; error: string }

/**
 * Creates a group chat and its memberships in one transaction. Every client
 * value is re-validated here, and bot ownership is checked against the
 * signed-in user instead of being trusted from the form.
 */
export async function createGroupChat(
  input: CreateGroupChatInput
): Promise<CreateGroupChatResult> {
  const parsed = createGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return {
      chatId: null,
      error: parsed.error.issues[0]?.message ?? "Invalid group chat",
    }
  }

  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    return { chatId: null, error: "You must be signed in" }
  }

  const ownedBots = await db
    .select({ id: bots.id })
    .from(bots)
    .where(
      and(eq(bots.userId, userId), inArray(bots.id, parsed.data.botIds))
    )

  if (ownedBots.length !== parsed.data.botIds.length) {
    return { chatId: null, error: "One or more bots could not be found" }
  }

  const chat = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(chats)
      .values({ userId, kind: "group", name: parsed.data.name })
      .returning({ id: chats.id })

    await tx.insert(chatMembers).values(
      parsed.data.botIds.map((botId) => ({ chatId: created.id, botId }))
    )

    return created
  })

  revalidatePath("/")
  return { chatId: chat.id, error: null }
}
