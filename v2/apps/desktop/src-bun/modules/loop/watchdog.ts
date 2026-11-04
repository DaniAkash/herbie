/**
 * The liveness half, which the tick source deliberately is not.
 *
 * A subject feeds this while it is genuinely working. When a feed does not
 * arrive within the deadline the subject is wedged, and nothing else would
 * have noticed: the clock would keep ticking, the loop would keep being
 * called, and a turn hung inside acpx would hold its slot forever.
 *
 * The deadline is 60s fed at 30s, which is the sd_notify convention of
 * feeding at half the deadline and lands exactly on the existing tick, so
 * there is no third timer. Guidance on watchdog intervals puts 10s in the
 * range that produces false positives from garbage collection and disk
 * latency, and 30 to 90s in the range that does not.
 */

const WATCHDOG_DEADLINE_MS = 60_000

export interface Watchdog {
  /** Says a subject is alive now, and resets its deadline. */
  feed: (subject: string, at: number) => void
  /** Stops watching one, for a subject that has gone away. */
  forget: (subject: string) => void
  /** Subjects whose deadline has passed, as of `at`. */
  wedged: (at: number) => string[]
  /**
   * Pushes every deadline forward, for a gap that was not a fault.
   *
   * A laptop closed overnight stops every feed for hours and that is
   * healthy. Without this the first tick after waking would declare every
   * subject wedged at once, which is the one interaction between sleep
   * detection and liveness detection.
   */
  slept: (at: number) => void
}

export function createWatchdog(
  deadlineMs: number = WATCHDOG_DEADLINE_MS,
): Watchdog {
  const seen = new Map<string, number>()

  return {
    feed(subject, at) {
      seen.set(subject, at)
    },
    forget(subject) {
      seen.delete(subject)
    },
    wedged(at) {
      const late: string[] = []
      for (const [subject, last] of seen) {
        if (at - last > deadlineMs) late.push(subject)
      }
      return late
    },
    slept(at) {
      for (const subject of seen.keys()) seen.set(subject, at)
    },
  }
}
