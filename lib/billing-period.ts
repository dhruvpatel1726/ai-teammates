import { clerkClient } from "@clerk/nextjs/server"

import { fallbackPeriod, type BillingPeriod } from "@/lib/usage"

/**
 * Resolve the Clerk subscription period that should own today's usage.
 *
 * Clerk exposes the period on each subscription item. When Billing is not
 * configured yet, a UTC calendar month keeps the ledger and reset countdown
 * meaningful, and the feature gate still blocks free users.
 */
export async function getBillingPeriod(userId: string): Promise<BillingPeriod> {
  try {
    const client = await clerkClient()
    const subscription =
      await client.billing.getUserBillingSubscription(userId)
    const now = Date.now()
    const item =
      subscription.subscriptionItems.find(
        (candidate) =>
          candidate.periodStart <= now &&
          candidate.periodEnd !== null &&
          candidate.periodEnd > now
      ) ?? subscription.subscriptionItems[0]

    if (item?.periodStart) {
      const start = new Date(item.periodStart)
      const end = item.periodEnd ? new Date(item.periodEnd) : undefined
      const resolvedEnd =
        end && end > start
          ? end
          : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))

      if (resolvedEnd > start) return { start, end: resolvedEnd }
    }
  } catch (error) {
    console.error("Could not read the Clerk billing period", error)
  }

  return fallbackPeriod()
}
