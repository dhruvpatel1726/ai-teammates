"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import {
  bots,
  chatMembers,
  chats,
  createBotSchema,
  type CreateBotInput,
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
