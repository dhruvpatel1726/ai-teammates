# Next.js template

This is a Next.js template with shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

## Database (Drizzle ORM + Neon Postgres)

Connection strings live in `.env.local` (see `.env.example`):

- `DATABASE_URL` — pooled connection, used by the app at runtime
- `DATABASE_URL_UNPOOLED` — direct connection, used by Drizzle Kit

The schema lives in `db/schema.ts` and the Drizzle client in `db/index.ts`.

```bash
npm run db:push      # apply db/schema.ts directly to the database
npm run db:studio    # browse the database
```

This project uses `drizzle-kit push` only. There are no migration files and no
migration history — the database is kept in sync with `db/schema.ts` directly.
