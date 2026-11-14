import { createInsertSchema } from "drizzle-zod"
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { nanoid } from "nanoid"
import { z } from "zod"

/**
 * A bot a user has created.
 *
 * `userId` is the third-party (Clerk) user ID. `sandboxId` is the third-party
 * sandbox ID, assigned lazily once the bot first needs one.
 */
export const bots = pgTable(
  "bots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    // Seed for the bot's generated face.
    avatar: text("avatar")
      .notNull()
      .$defaultFn(() => nanoid()),
    // What the bot is for, in a phrase.
    job: text("job").notNull(),
    // How it should go about the job.
    instructions: text("instructions"),
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)]
)

export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert

export const insertBotSchema = createInsertSchema(bots, {
  name: z
    .string()
    .trim()
    .min(1, "Bot name is required")
    .max(60, "Keep the name under 60 characters"),
  job: z
    .string()
    .trim()
    .min(1, "Bot job is required")
    .max(80, "Keep the job under 80 characters"),
  instructions: z
    .string()
    .trim()
    .max(2000, "Keep the instructions under 2000 characters")
    .nullish(),
})

export type InsertBotInput = z.infer<typeof insertBotSchema>

/**
 * The subset of an insert a user fills in when creating a bot. `userId` and
 * the other server-owned columns are added by the action, never the form.
 */
export const createBotSchema = insertBotSchema
  .pick({
    name: true,
    job: true,
    instructions: true,
  })
  .extend({
    avatar: z.string().min(1, "Pick a face for your bot"),
  })

export type CreateBotInput = z.infer<typeof createBotSchema>
