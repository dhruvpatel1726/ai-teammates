<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git

- **All work stays on `main`.** Never create, switch to, check out, rename, delete, or otherwise leave the `main` branch, and never create or use worktrees — not even temporarily, not even to "try something". Do not use `git checkout -b`, `git switch`, `git worktree add`, or any equivalent command. Do not use the session/worktree tools to move the session elsewhere.
- If a task would seem to require a different branch or a worktree, stop and tell the user rather than doing it on your own. The only exception is an explicit request from the user in the current request that names the specific branch/worktree action.
- Before any git operation, confirm the current branch with `git branch --show-current`. If it is not `main`, stop and do not proceed until the user says otherwise.
- Never create commits automatically. Only commit when the user explicitly asks for that specific action in the current request, and always commit on `main`.
- Leave changes uncommitted in the working tree on `main`, and let the user decide when and how to commit.

## Database

- Apply schema changes with `npm run db:push` (`drizzle-kit push`) only. Add `--force` when the shell has no TTY (agents/CI), since `push` refuses to prompt there.
- Never run migrations: no `drizzle-kit generate`, no `drizzle-kit migrate`, and do not create migration files, a migrations directory, or migration scripts.
- This is a development project. There is no backwards compatibility and the data is worthless. Prefer data loss: never backfill, migrate, or preserve existing rows, and never spend effort on keeping old data working. Every schema change means a clean state.

## Forms

Stack: shadcn `base-nova` (Base UI primitives), `react-hook-form`, Zod 4, `drizzle-zod`, Clerk 7, Next 16.

### One schema, defined in `db/schema.ts`

- Derive validation from the table with `createInsertSchema(table, { ...refinements })`. Never hand-write a parallel form schema.
- Normalize and cap user text in the schema (`.trim().min(1, "...").max(60, "...")`), not in the component, so the form and action behave identically.
- Export a second schema for the create form with `.pick()` of the user-editable columns, plus any client-supplied value such as an avatar seed. Server-owned columns (`id`, `userId`, `createdAt`) never appear in a form.
- Infer types with `z.infer` and use them on both sides: `useForm<CreateBotInput>(...)` and `createBot(input: CreateBotInput)`.

### Form markup

- Compose with `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError` inside a real `<form>`. No raw `div` + `label`, no `space-y-*`.
- Pair every `FieldLabel htmlFor` with the control's `id`. Render `<FieldError errors={[errors.name]} />`, set `data-invalid` on the `Field` and `aria-invalid` on the control.
- Use `Input`, `Textarea`, `Button`, and other controls from `components/ui`. Never raw HTML inputs.
- Suggestion chips are `Button type="button"` that call `form.setValue(..., { shouldDirty: true, shouldValidate: true })`. Real option sets (2–7 choices) use `ToggleGroup`.
- Any button inside a form that must not submit needs `type="button"`. Base UI `Button` defaults to `type="button"`, so the submit button must be explicit: `type="submit"`.

### react-hook-form

- Use `zodResolver` from `@hookform/resolvers/zod`.
- Read live values with `useWatch({ control, name })`, never `form.watch(...)`; React Compiler cannot memoize `watch()` and flags it as an incompatible library.
- Drive pending UI from `formState.isSubmitting`. `Button` has no `isLoading`; compose `<Spinner data-icon="inline-start" />` and `disabled`.
- Reset with `form.reset(defaultValues)` when the dialog closes or the submit succeeds.

### Dialog forms

- Always render a `DialogTitle` (use `className="sr-only"` only if it must be hidden).
- Keep `DialogHeader` outside the form, but put the fields and `DialogFooter` inside the same `<form>` so the footer's submit button submits. Base UI portals preserve React event bubbling, so this works.
- Use `render={<Button ... />}` for triggers and close buttons (Base UI). Never use `asChild`.
- Multi-field dialogs get `className="sm:max-w-md"`; the default `sm:max-w-sm` is too narrow for preset chips.
- Keep the trigger and dialog in one client component. Accept `defaultOpen` for deep links (`/?open=1`) and pass server-generated seeds down as props.

### Server actions

- Re-validate with the same schema using `safeParse`; return `{ error }` instead of throwing so the form can show it.
- `const { isAuthenticated, userId } = await auth()` from `@clerk/nextjs/server`. Never accept a `userId` from the client.
- Insert through `@/db` (the Postgres pool). Do not use `lib/db.ts`; it is a stale libsql client that does not match the Postgres schema.
- Call `revalidatePath("/")` after the mutation, and call the action with a typed object rather than `FormData`.

### Details that bite

- Never generate random seeds or IDs in `useState` initializers for rendered avatars: the client component is SSR'd, so server and client disagree and hydration fails. Pass a server seed as a prop, or generate in an event handler / effect.
- Show success and error feedback with `toast.add(...)` from `components/ui/toast` (Base UI). `Toaster` is already mounted in `app/layout.tsx`; Sonner is for Radix projects, not this one.
- Next 16: `searchParams` is a `Promise` — `const { open } = await searchParams`.
- Finish with `npm run typecheck` and `npx eslint <touched files>`. `npm run lint` also scans the `.agents`/`.claude` skill templates and reports unrelated warnings.

## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-chat-agent-advanced`, `trigger-cost-savings`, `trigger-realtime-and-frontend`, `trigger-authoring-chat-agent`, `trigger-getting-started`.
<!-- TRIGGER.DEV SKILLS END -->
