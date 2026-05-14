// Bun → renderer navigation hop. The tray click handler writes the
// target route here; the renderer polls GET /internal/tray-intent
// (while visible) and consumes the value. Keeping this in-memory is
// fine because both producer and consumer are inside the same bun
// process — and the renderer's window has to be visible to consume,
// so a stranded intent across an app restart wouldn't fire usefully
// anyway. A 30s stale-guard belt-and-suspenders that.

const STALE_MS = 30_000

let pending: { to: string; createdAt: number } | null = null

export function setPendingIntent(to: string): void {
  pending = { to, createdAt: Date.now() }
}

export function consumePendingIntent(): { to: string } | null {
  if (!pending) return null
  if (Date.now() - pending.createdAt > STALE_MS) {
    pending = null
    return null
  }
  const out = { to: pending.to }
  pending = null
  return out
}
