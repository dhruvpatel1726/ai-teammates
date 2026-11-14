import { relations } from "drizzle-orm"
import { createInsertSchema } from "drizzle-zod"
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
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

/**
 * A direct chat is one bot talking to the user; a group chat is several bots
 * sharing one conversation.
 */
export const chatKind = pgEnum("chat_kind", ["direct", "group"])

/**
 * A conversation between the user and one or more bots.
 *
 * `name` is only set for group chats. Direct chats take their title from the
 * single bot's name.
 */
export const chats = pgTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(),
    kind: chatKind("kind").notNull().default("direct"),
    name: text("name"),
    lastMessagePreview: text("last_message_preview"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("chats_user_id_idx").on(table.userId)]
)

/** Which bots belong to a chat, and when they joined it. */
export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.botId] }),
    index("chat_members_bot_id_idx").on(table.botId),
  ]
)

export type Chat = typeof chats.$inferSelect
export type NewChat = typeof chats.$inferInsert
export type ChatMember = typeof chatMembers.$inferSelect
export type NewChatMember = typeof chatMembers.$inferInsert

export const botsRelations = relations(bots, ({ many }) => ({
  memberships: many(chatMembers),
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
}))

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMembers.chatId],
    references: [chats.id],
  }),
  bot: one(bots, {
    fields: [chatMembers.botId],
    references: [bots.id],
  }),
}))
