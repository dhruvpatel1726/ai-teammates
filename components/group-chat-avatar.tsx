import { cn } from "cn"

import { ChatAvatar } from "@/components/chat-avatar"

type GroupChatAvatarProps = {
  /** Avatar seeds in chat order; only the first three are drawn. */
  seeds: string[]
  /** Overrides the root size, e.g. `size-9` in the chat header. */
  className?: string
}

// Each cell is a square slightly larger than a quarter of the root so the
// tiles overlap. The root itself stays the same size as a single ChatAvatar.
const CELL = "absolute size-[58%] overflow-hidden rounded-sm"

const positions: Record<number, string[]> = {
  1: ["left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"],
  2: [
    "left-0 top-1/2 -translate-y-1/2",
    "right-0 top-1/2 -translate-y-1/2",
  ],
  3: [
    "left-1/2 top-0 -translate-x-1/2",
    "bottom-0 left-0",
    "bottom-0 right-0",
  ],
  4: ["left-0 top-0", "right-0 top-0", "bottom-0 left-0", "bottom-0 right-0"],
}

/** A fixed-size avatar made of up to three bot faces plus a "+N" tile. */
function GroupChatAvatar({ seeds, className }: GroupChatAvatarProps) {
  if (seeds.length === 0) {
    return (
      <div
        className={cn("size-8 shrink-0 rounded-sm bg-muted", className)}
        aria-hidden
      />
    )
  }

  const visible = seeds.slice(0, 3)
  const extra = seeds.length - visible.length
  const tiles = extra > 0 ? [...visible, `+${extra}`] : visible
  const layout = positions[Math.min(tiles.length, 4)]

  return (
    <div
      className={cn("relative size-8 shrink-0", className)}
      aria-label={`Group chat with ${seeds.length} bots`}
      role="img"
    >
      {tiles.map((tile, index) => (
        <div className={cn(CELL, layout[index])} key={tile}>
          {tile.startsWith("+") ? (
            <span className="flex size-full items-center justify-center bg-muted text-[10px] font-medium text-muted-foreground">
              {tile}
            </span>
          ) : (
            <ChatAvatar seed={tile} className="size-full" />
          )}
        </div>
      ))}
    </div>
  )
}

export { GroupChatAvatar }
