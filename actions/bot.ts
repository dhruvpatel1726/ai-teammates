"use server"
import { db } from "@/lib/db"
import { bots, insertBotSchema } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"

export async function createBot(formData: FormData) {
  const user = await auth()
  if (!user?.userId) {
    return { error: "Unauthenticated" }
  }

  const parsed = insertBotSchema.parse({
    name: formData.get("name") as string,
    job: formData.get("job") as string,
    instructions: (formData.get("instructions") as string) || undefined,
  })

  const avatar = crypto.randomUUID()

  const bot = await db
    .insert(bots)
    .values({
      id: crypto.randomUUID(),
      userId: user.userId,
      name: parsed.name,
      avatar,
      job: parsed.job,
      instructions: parsed.instructions || null,
      sandboxId: parsed.sandboxId || null,
    })
    .returning();

  return { error: null, bot }
}