import type { Presence } from '@bun/modules/notifications/events'

/**
 * Whether the person is at the window, and what they are looking at.
 *
 * Held in memory and never persisted: it describes a webview that is running
 * right now, and a value that outlived the process that reported it would be
 * worse than no value at all.
 */

/**
 * How long a report stays believable.
 *
 * Generous against the frontend's heartbeat, because the cost of being wrong
 * is asymmetric and the asymmetry runs one way only.
 */
export const PRESENCE_STALE_MS = 30_000

const ABSENT: Presence = { focused: false, agentId: null, at: 0 }

let last: Presence = ABSENT

export function reportPresence(snapshot: Presence): void {
  last = snapshot
}

/**
 * What to assume about the person right now.
 *
 * A stale report reads as absent rather than as watching, which is the only
 * safe direction: a webview that died must cause a notification too many,
 * never silence. Reading it the other way would suppress everything for an
 * app whose window is gone.
 */
export function currentPresence(at: number): Presence {
  if (at - last.at > PRESENCE_STALE_MS) return ABSENT
  return last
}

/** Drops what was reported, so one test cannot colour the next. */
export function resetPresence(): void {
  last = ABSENT
}
