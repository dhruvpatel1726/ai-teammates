"use client"

import * as React from "react"
import { UserButton } from "@clerk/nextjs"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

/**
 * The dashboard's navigation sidebar.
 *
 * Navigation is still empty; the footer holds the Clerk user menu.
 */
function AppSidebar() {
  // Clerk mounts its UI on the client, so the server has no user to render.
  // Waiting a tick avoids hydrating a placeholder into a fully rendered
  // UserButton, which React reports as a hydration mismatch.
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flips once, after hydration
    setMounted(true)
  }, [])

  return (
    <Sidebar>
      <SidebarHeader />

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
                        "flex h-full! w-full! items-center gap-2 rounded-md bg-transparent px-2! text-sm font-normal text-inherit ring-sidebar-ring outline-hidden hover:bg-transparent! hover:text-inherit! focus-visible:ring-2 active:bg-transparent! active:text-inherit!",
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
                <div className="flex h-12 w-full items-center gap-2 px-2">
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export { AppSidebar }
