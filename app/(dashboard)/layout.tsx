import { Suspense } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getUserChats } from "@/queries/bots"

async function UserSidebar() {
  const chats = await getUserChats()
  return <AppSidebar chats={chats} />
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SidebarProvider>
      <Suspense fallback={<AppSidebar chats={[]} />}>
        <UserSidebar />
      </Suspense>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
