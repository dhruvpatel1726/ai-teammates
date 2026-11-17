import { auth } from "@clerk/nextjs/server"

import { ChatAvatar } from "@/components/chat-avatar"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import BotDialog from "@/components/bot-dialog"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>
}) {
  // Signed-out visitors are redirected to /sign-in before anything renders.
  await auth.protect()

  // A fresh seed per request keeps the avatar changing on every refresh.
  const seed = crypto.randomUUID()

  const open = (await searchParams).open === "1"

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <ChatAvatar seed={seed} />
          </EmptyMedia>
          <EmptyTitle>Meet your first bot</EmptyTitle>
          <EmptyDescription className="text-wrap">
            Every bot gets its own personality, memory, and face. Spin one up
            and start the conversation.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <BotDialog defaultOpen={open} defaultAvatarSeed={seed} />
        </EmptyContent>
      </Empty>
    </div>
  )
}
