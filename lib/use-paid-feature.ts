"use client"

import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useCallback } from "react"

import { toast } from "@/components/ui/toast"
import {
  BILLABLE_FEATURES,
  PAID_FEATURE_MESSAGES,
  type BillableFeature,
} from "@/lib/billing"

/**
 * Client-side gate for billable features.
 *
 * This is only for immediate feedback — every action re-checks entitlement on
 * the server. New billable features (e.g. sandboxes) can reuse both helpers by
 * adding their slug to `BILLABLE_FEATURES`.
 */
export function usePaidFeature() {
  const { has, isLoaded } = useAuth()
  const router = useRouter()

  const canUse = useCallback(
    (feature: BillableFeature) => has({ feature: BILLABLE_FEATURES[feature] }),
    [has]
  )

  const showUpgradeToast = useCallback(
    (feature: BillableFeature) => {
      toast.add({
        type: "error",
        title: "Paid plan required",
        description: PAID_FEATURE_MESSAGES[feature],
        actionProps: {
          children: "View plans",
          onClick: () => router.push("/pricing"),
        },
        timeout: 8000,
      })
    },
    [router]
  )

  return { canUse, isLoaded, showUpgradeToast }
}
