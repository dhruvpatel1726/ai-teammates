import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Application users, keyed by their Clerk user ID.
 *
 * Clerk stays the source of truth for authentication; this table holds the
 * profile fields the app needs to query, join and reference with foreign keys.
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // Clerk user ID, e.g. "user_2abc..."
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("users_email_idx").on(table.email)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Simple per-user todo list.
 *
 * `user_id` holds the Clerk user ID. It is deliberately not a foreign key to
 * `users`: Clerk is the source of truth, and a todo should be writable even if
 * the local user row has not been synced yet.
 */
export const todos = pgTable(
  "todos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("todos_user_id_created_at_idx").on(table.userId, table.createdAt),
  ],
);

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
