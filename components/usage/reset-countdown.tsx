"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { useEffect, useState } from "react"

/**
 * Live "time till reset" label. The server passes its first render as
 * `initialLabel` so hydration matches, then the client keeps it fresh.
 */
export function ResetCountdown({
  resetAt,
  initialLabel,
}: {
  resetAt: string
  initialLabel: string
}) {
  const [label, setLabel] = useState(initialLabel)

  useEffect(() => {
    const update = () =>
      setLabel(`${formatDistanceToNowStrict(new Date(resetAt))} left`)
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [resetAt])

  return <span suppressHydrationWarning>{label}</span>
}
