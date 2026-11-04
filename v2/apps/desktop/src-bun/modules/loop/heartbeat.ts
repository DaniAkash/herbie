/**
 * The pulse, and the one thing in Herbie that runs without being asked.
 *
 * It is a tick source, not a heartbeat in the distributed-systems sense: it
 * drives work and proves nothing to anyone. The liveness half lives next
 * door in the watchdog, which observes whatever this feeds.
 *
 * Two properties it exists to have, both of which a plain `setInterval`
 * would fail at:
 *
 * `setInterval(fn, 30000)` promises at least 30s between calls, never 30s,
 * so every late call bakes its lateness in permanently. Each deadline here
 * is computed from a fixed origin instead, which absorbs a late tick rather
 * than compounding it.
 *
 * macOS gives no sleep or wake notification that reaches this process, so a
 * closed lid is detected after the fact, as a gap in the wall clock. A long
 * gap re-anchors rather than replaying: a laptop shut overnight is hundreds
 * of missed slots, and firing them all on wake would stampede every agent at
 * once. The due scan is idempotent and picks up whatever is genuinely
 * overdue on the next pass.
 */

const TICK_MS = 30_000

/**
 * Above worst-case event-loop starvation under a heavy turn, below any real
 * sleep. Deliberately a different number from the watchdog deadline: this
 * one answers "did the clock jump", that one answers "has it stopped".
 */
const WAKE_THRESHOLD_MS = 5_000

export interface Tick {
  /** Wall clock when the tick actually ran. */
  readonly at: number
  /** How late it was against its own schedule. */
  readonly drift: number
  /** Set when the gap was long enough to mean the machine slept. */
  readonly slept: number | null
}

export interface Clock {
  now: () => number
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void
}

const SYSTEM: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle),
}

export interface Heartbeat {
  stop: () => void
}

/**
 * Starts the pulse and hands every tick to `onTick`.
 *
 * `onTick` is awaited, so a slow pass delays the next tick rather than
 * overlapping with it. Overlapping passes would both scan and both try to
 * claim, which the claim is safe against, but a queue of overlapping scans
 * on a wedged pass is a worse failure than a late one.
 */
export function startHeartbeat(
  onTick: (tick: Tick) => void | Promise<void>,
  options: { readonly intervalMs?: number; readonly clock?: Clock } = {},
): Heartbeat {
  const interval = options.intervalMs ?? TICK_MS
  const clock = options.clock ?? SYSTEM

  let stopped = false
  let handle: ReturnType<typeof setTimeout> | null = null
  let expectedAt = clock.now() + interval

  const schedule = (): void => {
    if (stopped) return
    handle = clock.setTimeout(
      () => void fire(),
      Math.max(0, expectedAt - clock.now()),
    )
  }

  const fire = async (): Promise<void> => {
    if (stopped) return
    const at = clock.now()
    const drift = at - expectedAt

    let slept: number | null = null
    if (drift > WAKE_THRESHOLD_MS) {
      slept = drift
      // Re-anchor. Counting forward from the old origin here would queue up
      // every slot the machine slept through and fire them back to back.
      expectedAt = at + interval
    } else {
      expectedAt += interval
    }

    try {
      await onTick({ at, drift, slept })
    } catch {
      // A pass that threw must not kill the pulse. Whatever failed is the
      // caller's to log; stopping the clock over it would take down every
      // routine on the machine for one agent's bad turn.
    }
    schedule()
  }

  schedule()

  return {
    stop() {
      stopped = true
      if (handle !== null) clock.clearTimeout(handle)
    },
  }
}
