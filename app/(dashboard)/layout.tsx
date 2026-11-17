import { Suspense } from "react"
import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getUserBots, getUserChats } from "@/queries/bots"

// Keep in sync with SIDEBAR_COOKIE_NAME in components/ui/sidebar.tsx.
const SIDEBAR_COOKIE_NAME = "sidebar_state"

async function UserSidebar() {
  const [chats, bots] = await Promise.all([getUserChats(), getUserBots()])
  return <AppSidebar chats={chats} bots={bots} />
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Suspense fallback={<AppSidebar chats={[]} bots={[]} />}>
        <UserSidebar />
      </Suspense>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
