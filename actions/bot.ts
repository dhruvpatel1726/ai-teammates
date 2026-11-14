"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { bots, createBotSchema, type CreateBotInput } from "@/db/schema"

export type CreateBotResult =
  { botId: string; error: null } | { botId: null; error: string }

/**
 * Creates a bot owned by the signed-in user.
 *
 * Everything the form supplies is re-validated here: Server Actions are public
 * endpoints, so the client-side resolver is a convenience, not a guarantee.
 */
export async function createBot(
  input: CreateBotInput
): Promise<CreateBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    return { botId: null, error: "You need to be signed in to create a bot." }
  }

  const parsed = createBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      botId: null,
      error:
        parsed.error.issues[0]?.message ?? "Those bot details are not valid.",
    }
  }

  try {
    const [bot] = await db
      .insert(bots)
      .values({
        userId,
        name: parsed.data.name,
        job: parsed.data.job,
        avatar: parsed.data.avatar,
        instructions: parsed.data.instructions || null,
      })
      .returning()

    revalidatePath("/")

    return { botId: bot.id, error: null }
  } catch (error) {
    console.error("Failed to create bot", error)
    return {
      botId: null,
      error: "Could not create the bot. Please try again.",
    }
  }
}
