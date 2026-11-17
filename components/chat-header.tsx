"use client"

import { MonitorIcon } from "lucide-react"

import type { ChatDetails } from "@/chats/queries"
import BotDialog from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { useChatSidePanel } from "@/components/chat-side-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Button } from "@/components/ui/button"

/** The title bar shown above a chat's messages. */
export function ChatHeader({ chat }: { chat: ChatDetails }) {
  const { isOpen, toggle } = useChatSidePanel()
  const isGroup = chat.kind === "group"

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4">
      <div className="flex min-w-0 items-center gap-3">
        {isGroup ? (
          <GroupChatAvatar
            seeds={chat.bots.map((bot) => bot.avatar)}
            className="size-9"
          />
        ) : chat.bot ? (
          <BotDialog
            bot={chat.bot}
            defaultAvatarSeed={chat.bot.avatar}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit bot"
                className="size-9 rounded-full p-0"
              >
                <ChatAvatar
                  seed={chat.bot.avatar}
                  className="size-9 rounded-full"
                />
              </Button>
            }
          />
        ) : (
          <ChatAvatar seed={chat.id} className="size-9" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{chat.title}</p>
          {isGroup ? (
            <p className="truncate text-xs text-muted-foreground">
              {chat.bots.map((bot) => bot.name).join(", ")}
            </p>
          ) : (
            chat.bot && (
              <p className="truncate text-xs text-muted-foreground">
                {chat.bot.job}
              </p>
            )
          )}
        </div>
      </div>

      {!isGroup && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={isOpen ? "Close side panel" : "Open side panel"}
          aria-pressed={isOpen}
          onClick={toggle}
        >
          <MonitorIcon />
        </Button>
      )}
    </header>
  )
}
