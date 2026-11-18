/**
 * Clerk Billing feature slugs.
 *
 * Create these features in the Clerk Dashboard and attach them to the paid
 * user plan. `has({ feature: ... })` then returns true only for subscribers.
 */
export const BILLABLE_FEATURES = {
  bots: "bots",
  sandboxes: "sandboxes",
} as const

export type BillableFeature = keyof typeof BILLABLE_FEATURES

/** The structured error code used when a Server Action blocks a free user. */
export const PAID_FEATURE_ERROR_CODE = "paid_feature_required" as const

/** Shown in the blocking toast and when a Server Action rejects a free user. */
export const PAID_FEATURE_MESSAGES: Record<BillableFeature, string> = {
  bots: "Bots are a paid feature. Upgrade to create and chat with them.",
  sandboxes:
    "Sandboxes are a paid feature. Upgrade to create and connect them.",
}
