import type { LanguageModelUsage } from "ai"
import { and, desc, eq, gt, lte, sql } from "drizzle-orm"

import { db } from "@/db"
import { usageEntries, usagePeriods } from "@/db/schema"

/** Ledger buckets map to the values in the `usage_category` Postgres enum. */
export const USAGE_CATEGORIES = {
  aiTokens: "ai_tokens",
  sandboxes: "sandboxes",
} as const

export type UsageCategoryKey = keyof typeof USAGE_CATEGORIES
export type BillingPeriod = { start: Date; end: Date }

function dollarLimit(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Hard caps for one subscription period. Override with env vars per deployment. */
export const USAGE_LIMIT_USD: Record<UsageCategoryKey, number> = {
  aiTokens: dollarLimit("USAGE_AI_LIMIT_USD", 5),
  sandboxes: dollarLimit("USAGE_SANDBOX_LIMIT_USD", 5),
}

const toMicros = (usd: number) => Math.round(usd * 1_000_000)

export const USAGE_LIMIT_MICROS: Record<UsageCategoryKey, number> = {
  aiTokens: toMicros(USAGE_LIMIT_USD.aiTokens),
  sandboxes: toMicros(USAGE_LIMIT_USD.sandboxes),
}

/** Keep a little room so a turn is never started with an effectively empty budget. */
export const MIN_TURN_RESERVE_MICROS = toMicros(0.001)

export const USAGE_LIMIT_ERROR_CODE = "usage_limit_reached" as const

export const USAGE_LIMIT_MESSAGES: Record<UsageCategoryKey, string> = {
  aiTokens:
    "You've used this period's AI budget. It resets at the start of your next billing period.",
  sandboxes:
    "You've used this period's sandbox budget. It resets at the start of your next billing period.",
}

export class UsageLimitError extends Error {
  readonly code = USAGE_LIMIT_ERROR_CODE

  constructor(readonly category: UsageCategoryKey) {
    super(USAGE_LIMIT_MESSAGES[category])
    this.name = "UsageLimitError"
  }
}

/**
 * xAI still resolves the retired `grok-4-1-fast-non-reasoning` slug, but it is
 * served by `grok-4.3` and billed at 4.3 rates. Cached-read pricing for 4.3 is
 * not published, so cached tokens are charged at the full input rate. The
 * ledger is our internal cost guard, so over-estimating is safer than under.
 *
 * Source: https://docs.x.ai/developers/migration/may-15-retirement
 */
export const XAI_PRICING_USD_PER_MILLION = {
  input: 1.25,
  output: 2.5,
  cacheRead: 1.25,
} as const

/** Return a UTC calendar-month period when Clerk has no subscription yet. */
export function fallbackPeriod(now = new Date()): BillingPeriod {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  }
}

export function estimateTokenCostUsd(
  _model: string,
  usage: LanguageModelUsage
): number {
  const details = usage.inputTokenDetails
  const cached = Math.max(0, details?.cacheReadTokens ?? 0)
  const inputTotal = Math.max(0, usage.inputTokens ?? 0)
  const billableInput = Math.max(
    0,
    details?.noCacheTokens ?? inputTotal - cached
  )
  const output = Math.max(0, usage.outputTokens ?? 0)
  const rates = XAI_PRICING_USD_PER_MILLION

  return (
    (billableInput * rates.input +
      cached * rates.cacheRead +
      output * rates.output) /
    1_000_000
  )
}

export type UsageBucket = {
  spentMicros: number
  limitMicros: number
  remainingMicros: number
  percent: number
}

export type UsageSummary = {
  period: BillingPeriod
  buckets: Record<UsageCategoryKey, UsageBucket>
}

function bucketFor(spentMicros: number, limitMicros: number): UsageBucket {
  return {
    spentMicros,
    limitMicros,
    remainingMicros: Math.max(0, limitMicros - spentMicros),
    percent:
      limitMicros === 0 ? 0 : Math.min(100, (spentMicros / limitMicros) * 100),
  }
}

/** Read-only spend snapshot for the usage page and pre-flight budget checks. */
export async function getUsageSummary(
  userId: string,
  period: BillingPeriod
): Promise<UsageSummary> {
  const [row] = await db
    .select()
    .from(usagePeriods)
    .where(
      and(
        eq(usagePeriods.userId, userId),
        eq(usagePeriods.periodStart, period.start)
      )
    )
    .limit(1)

  return {
    period,
    buckets: {
      aiTokens: bucketFor(row?.aiSpentMicros ?? 0, USAGE_LIMIT_MICROS.aiTokens),
      sandboxes: bucketFor(
        row?.sandboxSpentMicros ?? 0,
        USAGE_LIMIT_MICROS.sandboxes
      ),
    },
  }
}

/** Create the period row once; Clerk periods and the worker share this key. */
export async function ensureUsagePeriod(userId: string, period: BillingPeriod) {
  await db
    .insert(usagePeriods)
    .values({
      userId,
      periodStart: period.start,
      periodEnd: period.end,
    })
    .onConflictDoNothing({
      target: [usagePeriods.userId, usagePeriods.periodStart],
    })

  const [row] = await db
    .select()
    .from(usagePeriods)
    .where(
      and(
        eq(usagePeriods.userId, userId),
        eq(usagePeriods.periodStart, period.start)
      )
    )
    .limit(1)

  if (!row) throw new Error("Could not open the current usage period.")
  return row
}

/**
 * The Trigger worker cannot call Clerk per turn, so it reuses the period the
 * server action stored. If the period rolled over mid-session, a UTC month is
 * used until the next browser action refreshes it from Clerk.
 */
export async function getActiveUsagePeriod(
  userId: string,
  now = new Date()
): Promise<BillingPeriod> {
  const [row] = await db
    .select()
    .from(usagePeriods)
    .where(
      and(
        eq(usagePeriods.userId, userId),
        lte(usagePeriods.periodStart, now),
        gt(usagePeriods.periodEnd, now)
      )
    )
    .orderBy(desc(usagePeriods.periodStart))
    .limit(1)

  if (row) return { start: row.periodStart, end: row.periodEnd }

  const fallback = fallbackPeriod(now)
  await ensureUsagePeriod(userId, fallback)
  return fallback
}

export async function hasBudget(
  userId: string,
  period: BillingPeriod,
  category: UsageCategoryKey,
  reserveMicros = 0
) {
  const summary = await getUsageSummary(userId, period)
  return summary.buckets[category].remainingMicros > reserveMicros
}

export type ChargeUsageInput = {
  userId: string
  period: BillingPeriod
  category: UsageCategoryKey
  costUsd: number
  source: string
  referenceId?: string
  tokens?: { inputTokens?: number; outputTokens?: number }
  sandbox?: {
    cpuCoreSeconds?: number
    memoryGiBSeconds?: number
    diskGiBSeconds?: number
  }
}

export type ChargeResult = {
  allowed: boolean
  spentMicros: number
  remainingMicros: number
}

/**
 * Atomically charge a billable event against the period.
 *
 * The conditional increment is the hard cap: two concurrent turns cannot both
 * spend the same remaining budget. The audit entry is written in the same
 * transaction so the rollup always has a matching ledger row.
 */
export async function chargeUsage(
  input: ChargeUsageInput
): Promise<ChargeResult> {
  const costMicros = Math.max(0, toMicros(input.costUsd))
  const limitMicros = USAGE_LIMIT_MICROS[input.category]

  return db.transaction(async (tx) => {
    await tx
      .insert(usagePeriods)
      .values({
        userId: input.userId,
        periodStart: input.period.start,
        periodEnd: input.period.end,
      })
      .onConflictDoNothing({
        target: [usagePeriods.userId, usagePeriods.periodStart],
      })

    const [row] = await tx
      .select()
      .from(usagePeriods)
      .where(
        and(
          eq(usagePeriods.userId, input.userId),
          eq(usagePeriods.periodStart, input.period.start)
        )
      )
      .limit(1)

    if (!row) throw new Error("Could not open the current usage period.")

    const spentField =
      input.category === "aiTokens"
        ? usagePeriods.aiSpentMicros
        : usagePeriods.sandboxSpentMicros
    const currentSpent =
      input.category === "aiTokens"
        ? row.aiSpentMicros
        : row.sandboxSpentMicros

    if (costMicros > 0) {
      const increment =
        input.category === "aiTokens"
          ? { aiSpentMicros: sql`${usagePeriods.aiSpentMicros} + ${costMicros}` }
          : {
              sandboxSpentMicros: sql`${usagePeriods.sandboxSpentMicros} + ${costMicros}`,
            }

      const [updated] = await tx
        .update(usagePeriods)
        .set(increment)
        .where(
          and(
            eq(usagePeriods.id, row.id),
            lte(spentField, limitMicros - costMicros)
          )
        )
        .returning({
          ai: usagePeriods.aiSpentMicros,
          sandbox: usagePeriods.sandboxSpentMicros,
        })

      if (!updated) {
        return {
          allowed: false,
          spentMicros: currentSpent,
          remainingMicros: Math.max(0, limitMicros - currentSpent),
        }
      }

      const spentMicros =
        input.category === "aiTokens" ? updated.ai : updated.sandbox

      await tx.insert(usageEntries).values({
        periodId: row.id,
        category: USAGE_CATEGORIES[input.category],
        costMicros,
        inputTokens: input.tokens?.inputTokens ?? null,
        outputTokens: input.tokens?.outputTokens ?? null,
        cpuCoreSeconds: input.sandbox?.cpuCoreSeconds?.toString() ?? null,
        memoryGiBSeconds: input.sandbox?.memoryGiBSeconds?.toString() ?? null,
        diskGiBSeconds: input.sandbox?.diskGiBSeconds?.toString() ?? null,
        source: input.source,
        referenceId: input.referenceId ?? null,
      })

      return {
        allowed: true,
        spentMicros,
        remainingMicros: Math.max(0, limitMicros - spentMicros),
      }
    }

    await tx.insert(usageEntries).values({
      periodId: row.id,
      category: USAGE_CATEGORIES[input.category],
      costMicros: 0,
      source: input.source,
      referenceId: input.referenceId ?? null,
    })

    return {
      allowed: true,
      spentMicros: currentSpent,
      remainingMicros: Math.max(0, limitMicros - currentSpent),
    }
  })
}

/**
 * Hook for the future Daytona runtime: every sandbox create/start/usage event
 * should pass through here so it is capped by the same period ledger.
 */
export function chargeSandboxUsage(
  input: Omit<ChargeUsageInput, "category">
): Promise<ChargeResult> {
  return chargeUsage({ ...input, category: "sandboxes" })
}
