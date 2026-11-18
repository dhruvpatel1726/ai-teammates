import { PricingTable } from "@clerk/nextjs"

export default function PricingPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-8 px-4 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Choose your plan
        </h1>
        <p className="text-muted-foreground">
          Upgrade to create bots, chat with your teammates, and unlock
          sandboxes.
        </p>
      </div>
      <PricingTable />
    </main>
  )
}
