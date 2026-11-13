import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js keeps secrets in .env.local; fall back to .env for other setups.
config({ path: [".env.local", ".env"], quiet: true });

// Schema changes go straight to the database with `drizzle-kit push`. Use the
// direct (non-pooled) connection: PgBouncer in transaction mode does not
// support the session state DDL relies on.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set in .env.local",
  );
}

export default defineConfig({
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
