"use client"

import * as React from "react"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BotIcon, MessageCircleIcon, PlusIcon, SearchIcon } from "lucide-react"

import { refreshUserChats } from "@/actions/chat"
import BotDialog from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  BOT_CREATED_EVENT,
  BOT_DELETED_EVENT,
  BOT_UPDATED_EVENT,
} from "@/lib/chat-events"
import type { PickableBot, UserChat } from "@/queries/bots"

/**
 * The dashboard's navigation sidebar.
 *
 * The content lists the signed-in user's chats; the footer holds the Clerk
 * user menu.
 */
function AppSidebar({
  chats: initialChats,
  bots,
}: {
  chats: UserChat[]
  bots: PickableBot[]
}) {
  const pathname = usePathname()
  const router = useRouter()

  // The dashboard route group does not affect the URL, so the active chat is
  // the segment immediately after /chats/.
  const activeChatId = pathname.match(/^\/chats\/([^/]+)/)?.[1] ?? null

  // Clerk mounts its UI on the client, so the server has no user to render.
  // Waiting a tick avoids hydrating a placeholder into a fully rendered
  // UserButton, which React reports as a hydration mismatch.
  const [mounted, setMounted] = React.useState(false)
  const [newBotSeed, setNewBotSeed] = React.useState<string | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [groupChatOpen, setGroupChatOpen] = React.useState(false)
  const [chats, setChats] = React.useState(initialChats)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flips once, after hydration
    setMounted(true)
  }, [])

  const refreshChats = React.useCallback(() => {
    refreshUserChats()
      .then(setChats)
      .catch((error) => console.error("Failed to refresh chats", error))
  }, [])

  React.useEffect(() => {
    window.addEventListener(BOT_CREATED_EVENT, refreshChats)
    window.addEventListener(BOT_UPDATED_EVENT, refreshChats)
    window.addEventListener(BOT_DELETED_EVENT, refreshChats)
    return () => {
      window.removeEventListener(BOT_CREATED_EVENT, refreshChats)
      window.removeEventListener(BOT_UPDATED_EVENT, refreshChats)
      window.removeEventListener(BOT_DELETED_EVENT, refreshChats)
    }
  }, [refreshChats])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="items-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label="Create" />}
          >
            <PlusIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => setNewBotSeed(crypto.randomUUID())}
              >
                <BotIcon />
                Create a new bot
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupChatOpen(true)}>
                <MessageCircleIcon />
                Create a group chat
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          className="h-8 w-full min-w-0 justify-start rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
          onClick={() => setSearchOpen(true)}
        >
          <SearchIcon data-icon="inline-start" />
          <span className="min-w-0 truncate text-muted-foreground group-data-[collapsible=icon]:hidden">
            Search chats...
          </span>
          <KbdGroup className="ml-auto group-data-[collapsible=icon]:hidden">
            <Kbd>
              {mounted && /Mac|iPhone|iPad/.test(navigator.userAgent)
                ? "⌘"
                : "Ctrl"}
            </Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={chat.title}
                    render={<Link href={`/chats/${chat.id}`} />}
                    isActive={chat.id === activeChatId}
                  >
                    {chat.kind === "group" ? (
                      <GroupChatAvatar seeds={chat.botAvatars} />
                    ) : (
                      <ChatAvatar seed={chat.avatarSeed} />
                    )}
                    <span className="min-w-0 truncate group-data-[collapsible=icon]:hidden">
                      {chat.title}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                      {chat.dateLabel}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/*
              Rendered as a `div` so the row owns the menu styling the same way a
              regular SidebarMenuButton does, while Clerk keeps its own trigger
              button. The trigger is stretched over the row so every pixel is
              clickable and transparent so the row's hover/active state shows.
            */}
            <SidebarMenuButton size="lg" render={<div />} className="p-0">
              {mounted ? (
                <UserButton
                  showName
                  appearance={{
                    elements: {
                      // Clerk sizes the host to its content; `!` beats that rule
                      // so the trigger can fill the sidebar row.
                      rootBox: "h-full! w-full!",
                      userButtonTrigger:
                        "flex h-full! w-full! items-center gap-2 rounded-md bg-transparent px-2! text-sm font-normal text-inherit ring-sidebar-ring outline-hidden hover:bg-transparent! hover:text-inherit! focus-visible:ring-2 active:bg-transparent! active:text-inherit! group-data-[collapsible=icon]:px-0!",
                      userButtonBox: "min-w-0 flex-1 justify-start gap-2",
                      userButtonOuterIdentifier:
                        "truncate text-sm font-normal text-inherit group-data-[collapsible=icon]:hidden",
                      // Clerk pins the avatar box size with its own rule, so the
                      // height/width utilities need `!` to land on 1.5rem.
                      userButtonAvatarBox: "size-6! shrink-0",
                    },
                  }}
                />
              ) : (
                <div className="flex h-12 w-full items-center gap-2 px-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!">
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-24 group-data-[collapsible=icon]:hidden" />
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search chats"
        description="Search your chats"
      >
        <Command>
          <CommandInput placeholder="Search chats..." />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => (
                <CommandItem
                  key={chat.id}
                  value={chat.id}
                  keywords={[chat.title]}
                  onSelect={() => {
                    setSearchOpen(false)
                    router.push(`/chats/${chat.id}`)
                  }}
                >
                  {chat.kind === "group" ? (
                    <GroupChatAvatar seeds={chat.botAvatars} />
                  ) : (
                    <ChatAvatar seed={chat.avatarSeed} />
                  )}
                  <span className="min-w-0 truncate">{chat.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {chat.dateLabel}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>

      {newBotSeed && (
        <BotDialog
          key={newBotSeed}
          defaultOpen
          defaultAvatarSeed={newBotSeed}
          showTrigger={false}
          onOpenChange={(open) => {
            if (!open) {
              setNewBotSeed(null)
            }
          }}
        />
      )}

      <GroupChatDialog
        bots={bots}
        open={groupChatOpen}
        onOpenChange={setGroupChatOpen}
        onCreated={refreshChats}
      />

      <SidebarRail />
    </Sidebar>
  )
}

export { AppSidebar }
