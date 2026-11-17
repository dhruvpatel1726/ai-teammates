"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import {
  bots,
  chatMembers,
  chats,
  createBotSchema,
  type CreateBotInput,
  deleteBotSchema,
  type DeleteBotInput,
  updateBotSchema,
  type UpdateBotInput,
} from "@/db/schema"

export type CreateBotResult =
  | { botId: string; chatId: string; error: null }
  | { botId: null; chatId: null; error: string }

/**
 * Creates a bot together with its direct chat and membership.
 *
 * Everything the form supplies is re-validated here: Server Actions are public
 * endpoints, so the client-side resolver is a convenience, not a guarantee.
 * The three inserts share one transaction so a bot never exists without the
 * chat that opens it.
 */
export async function createBot(
  input: CreateBotInput
): Promise<CreateBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    return {
      botId: null,
      chatId: null,
      error: "You need to be signed in to create a bot.",
    }
  }

  const parsed = createBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      botId: null,
      chatId: null,
      error:
        parsed.error.issues[0]?.message ?? "Those bot details are not valid.",
    }
  }

  try {
    const { botId, chatId } = await db.transaction(async (tx) => {
      const [bot] = await tx
        .insert(bots)
        .values({
          userId,
          name: parsed.data.name,
          job: parsed.data.job,
          avatar: parsed.data.avatar,
          instructions: parsed.data.instructions || null,
        })
        .returning()

      const [chat] = await tx
        .insert(chats)
        .values({
          userId,
          kind: "direct",
        })
        .returning()

      await tx.insert(chatMembers).values({
        chatId: chat.id,
        botId: bot.id,
      })

      return { botId: bot.id, chatId: chat.id }
    })

    revalidatePath("/")

    return { botId, chatId, error: null }
  } catch (error) {
    console.error("Failed to create bot", error)
    return {
      botId: null,
      chatId: null,
      error: "Could not create the bot. Please try again.",
    }
  }
}

/** Update the editable fields of a bot owned by the signed-in Clerk user. */
export async function updateBot(
  input: UpdateBotInput
): Promise<{ error: string | null }> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    return { error: "You need to be signed in to update a bot." }
  }

  // Server Actions are public endpoints, so re-validate instead of trusting
  // the form's resolver.
  const parsed = updateBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Those bot details are not valid.",
    }
  }

  const { id, name, job, avatar, instructions } = parsed.data

  try {
    const [updated] = await db
      .update(bots)
      .set({ name, job, avatar, instructions: instructions || null })
      .where(and(eq(bots.id, id), eq(bots.userId, userId)))
      .returning({ id: bots.id })

    if (!updated) {
      return { error: "That bot could not be found." }
    }

    revalidatePath("/")
    return { error: null }
  } catch (error) {
    console.error("Failed to update bot", error)
    return { error: "Could not update the bot. Please try again." }
  }
}

/**
 * Delete a bot owned by the signed-in Clerk user, along with its direct chat.
 *
 * The ownership check runs before anything is deleted, and both deletes share
 * a transaction so a bot is never removed while its chat is left behind.
 * Group chats keep existing; deleting a bot only removes its memberships.
 */
export async function deleteBot(
  input: DeleteBotInput
): Promise<{ error: string | null }> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    return { error: "You need to be signed in to delete a bot." }
  }

  const parsed = deleteBotSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "That bot could not be found." }
  }

  const { id } = parsed.data

  try {
    const [bot] = await db
      .select({ id: bots.id })
      .from(bots)
      .where(and(eq(bots.id, id), eq(bots.userId, userId)))
      .limit(1)

    if (!bot) {
      return { error: "That bot could not be found." }
    }

    await db.transaction(async (tx) => {
      const directChats = await tx
        .select({ chatId: chatMembers.chatId })
        .from(chatMembers)
        .innerJoin(chats, eq(chats.id, chatMembers.chatId))
        .where(
          and(
            eq(chatMembers.botId, id),
            eq(chats.userId, userId),
            eq(chats.kind, "direct")
          )
        )

      for (const { chatId } of directChats) {
        await tx
          .delete(chats)
          .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      }

      await tx.delete(bots).where(and(eq(bots.id, id), eq(bots.userId, userId)))
    })

    revalidatePath("/")
    return { error: null }
  } catch (error) {
    console.error("Failed to delete bot", error)
    return { error: "Could not delete the bot. Please try again." }
  }
}
