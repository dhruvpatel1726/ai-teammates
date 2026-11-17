"use server"

import { getUserChats } from "@/queries/bots"

/** Refetch the signed-in user's chats on demand, e.g. after creating a bot. */
export async function refreshUserChats() {
  return getUserChats()
}
