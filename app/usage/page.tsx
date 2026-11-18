import { auth } from "@clerk/nextjs/server"
import { format, formatDistanceToNowStrict } from "date-fns"
import Link from "next/link"

import { ResetCountdown } from "@/components/usage/reset-countdown"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { getBillingPeriod } from "@/lib/billing-period"
import {
  getUsageSummary,
  type UsageBucket,
  type UsageCategoryKey,
} from "@/lib/usage"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

const BUCKETS: {
  key: UsageCategoryKey
  title: string
  description: string
}[] = [
  {
    key: "aiTokens",
    title: "AI tokens",
    description: "Provider token spend for every teammate message.",
  },
  {
    key: "sandboxes",
    title: "Daytona sandboxes",
    description:
      "CPU, memory and disk spend. Metered here when sandbox runtime is enabled.",
  },
]

function UsageCard({
  title,
  description,
  bucket,
}: {
  title: string
  description: string
  bucket: UsageBucket
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Progress value={bucket.percent}>
          <ProgressLabel>{bucket.percent.toFixed(0)}% used</ProgressLabel>
          <ProgressValue>
            {() =>
              `${money.format(bucket.spentMicros / 1_000_000)} of ${money.format(bucket.limitMicros / 1_000_000)}`
            }
          </ProgressValue>
        </Progress>
        <p className="text-sm text-muted-foreground">
          {money.format(bucket.remainingMicros / 1_000_000)} remaining this
          period
        </p>
      </CardContent>
    </Card>
  )
}

export default async function UsagePage() {
  const { userId } = await auth.protect()
  const period = await getBillingPeriod(userId)
  const summary = await getUsageSummary(userId, period)
  const resetAt = period.end.toISOString()
  const resetLabel = `${formatDistanceToNowStrict(period.end)} left`

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Usage</h1>
        <p className="text-muted-foreground">
          Your limits reset with your billing period. Requests are blocked once
          a budget is spent.
        </p>
      </div>

      <div className="grid gap-4">
        {BUCKETS.map(({ key, title, description }) => (
          <UsageCard
            description={description}
            bucket={summary.buckets[key]}
            key={key}
            title={title}
          />
        ))}
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>
            Resets <ResetCountdown initialLabel={resetLabel} resetAt={resetAt} />
          </CardTitle>
          <CardDescription>
            {format(period.end, "MMMM d, yyyy 'at' h:mm a")} · Counters return
            to zero automatically.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex justify-center">
        <Button render={<Link href="/pricing" />} variant="outline">
          View plans
        </Button>
      </div>
    </main>
  )
}
