import { describe, expect, test } from 'bun:test'
import {
  type Clock,
  startHeartbeat,
  type Tick,
} from '@bun/modules/loop/heartbeat'
import { createWatchdog } from '@bun/modules/loop/watchdog'

/**
 * A clock the test drives by hand.
 *
 * Deliberately not a fake timer library: the thing under test is how it
 * computes its next deadline from wall clock, so the test has to be able to
 * move wall clock and the timer queue independently. That is exactly the
 * laptop-sleep case.
 */
function fakeClock(start = 1_000_000) {
  let now = start
  let next = 1
  const pending = new Map<number, { at: number; fn: () => void }>()

  const clock: Clock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = next++
      pending.set(id, { at: now + ms, fn })
      return id as unknown as ReturnType<typeof setTimeout>
    },
    clearTimeout: (handle) => {
      pending.delete(handle as unknown as number)
    },
  }

  return {
    clock,
    /** Moves wall clock and runs whatever came due, oldest first. */
    async advance(ms: number) {
      now += ms
      let ran = true
      while (ran) {
        ran = false
        for (const [id, task] of [...pending].sort(
          (a, b) => a[1].at - b[1].at,
        )) {
          if (task.at <= now) {
            pending.delete(id)
            task.fn()
            ran = true
            // Let the awaited onTick settle before the next one is due.
            await Promise.resolve()
            await Promise.resolve()
          }
        }
      }
    },
    /** Jumps wall clock without running anything, which is what sleep is. */
    sleep(ms: number) {
      now += ms
    },
  }
}

describe('the heartbeat', () => {
  test('ticks on its interval', async () => {
    const t = fakeClock()
    const ticks: Tick[] = []
    const beat = startHeartbeat(
      (tick) => {
        ticks.push(tick)
      },
      {
        intervalMs: 1000,
        clock: t.clock,
      },
    )

    await t.advance(3000)
    beat.stop()

    expect(ticks).toHaveLength(3)
    expect(ticks.every((tick) => tick.slept === null)).toBe(true)
  })

  test('absorbs a late tick instead of compounding it', async () => {
    const t = fakeClock()
    const ticks: Tick[] = []
    const beat = startHeartbeat(
      (tick) => {
        ticks.push(tick)
      },
      {
        intervalMs: 1000,
        clock: t.clock,
      },
    )

    // One pass runs 400ms late. The next deadline is computed from the fixed
    // origin, so the lateness does not carry into it.
    await t.advance(1400)
    expect(ticks[0]?.drift).toBe(400)

    await t.advance(600)
    expect(ticks).toHaveLength(2)
    // Second tick lands on its own origin, 2000, not 1400 + 1000.
    expect(ticks[1]?.drift).toBe(0)

    beat.stop()
  })

  test('reads a long gap as sleep and does not replay the missed slots', async () => {
    const t = fakeClock()
    const ticks: Tick[] = []
    const beat = startHeartbeat(
      (tick) => {
        ticks.push(tick)
      },
      {
        intervalMs: 1000,
        clock: t.clock,
      },
    )

    // Eight hours with the lid shut: wall clock moves, nothing runs.
    t.sleep(8 * 60 * 60 * 1000)
    await t.advance(0)

    expect(ticks).toHaveLength(1)
    // The gap measured against the deadline it missed, so the whole sleep
    // less the one interval that had already been scheduled.
    expect(ticks[0]?.slept).toBe(8 * 60 * 60 * 1000 - 1000)

    // The 28,800 slots it slept through are gone, not queued.
    await t.advance(1000)
    expect(ticks).toHaveLength(2)
    expect(ticks[1]?.slept).toBeNull()

    beat.stop()
  })

  test('keeps beating when a pass throws', async () => {
    const t = fakeClock()
    let passes = 0
    const beat = startHeartbeat(
      () => {
        passes += 1
        throw new Error('the scan blew up')
      },
      { intervalMs: 1000, clock: t.clock },
    )

    await t.advance(3000)
    beat.stop()

    // One agent's bad pass must not take down every routine on the machine.
    expect(passes).toBe(3)
  })

  test('stops when told to', async () => {
    const t = fakeClock()
    let passes = 0
    const beat = startHeartbeat(
      () => {
        passes += 1
      },
      { intervalMs: 1000, clock: t.clock },
    )

    await t.advance(1000)
    beat.stop()
    await t.advance(5000)

    expect(passes).toBe(1)
  })
})

describe('the watchdog', () => {
  test('reports a subject that stopped feeding', () => {
    const dog = createWatchdog(60_000)
    dog.feed('scout', 1000)

    expect(dog.wedged(50_000)).toEqual([])
    expect(dog.wedged(70_000)).toEqual(['scout'])
  })

  test('a fed subject is not wedged', () => {
    const dog = createWatchdog(60_000)
    dog.feed('scout', 1000)
    dog.feed('scout', 60_000)

    expect(dog.wedged(70_000)).toEqual([])
  })

  test('sleeping is not wedging', () => {
    const dog = createWatchdog(60_000)
    dog.feed('scout', 1000)

    // Eight hours later the feed is ancient, and that is healthy.
    const wake = 8 * 60 * 60 * 1000
    dog.slept(wake)

    expect(dog.wedged(wake + 1000)).toEqual([])
  })

  test('forgets a subject that went away', () => {
    const dog = createWatchdog(60_000)
    dog.feed('scout', 1000)
    dog.forget('scout')

    expect(dog.wedged(999_999)).toEqual([])
  })
})
