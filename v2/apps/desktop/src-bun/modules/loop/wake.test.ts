import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Db } from '@bun/modules/db/db'
import { openDb } from '@bun/modules/db/db'
import {
  agents,
  routineRuns,
  routines,
  settings,
} from '@bun/modules/db/schema/schema'
import type { Clock } from '@bun/modules/loop/heartbeat'
import { QUIET_HOURS_KEY, startLoop } from '@bun/modules/loop/loop'

/**
 * The laptop-sleep path, driven through the whole loop rather than through
 * the heartbeat's arithmetic alone.
 *
 * The heartbeat's own tests prove it reports a gap. What they cannot prove
 * is the thing that actually matters: that a machine shut overnight does not
 * wake up and fire every slot it missed, and that the hours of silence are
 * not mistaken for a wedge. Both of those are decisions the loop makes with
 * the tick, not decisions the tick makes by itself.
 */

const started: { agentId: string; text: string }[] = []
mock.module('@bun/modules/conversation/turns', () => ({
  startTurn: (_db: Db, agentId: string, text: string) => {
    started.push({ agentId, text })
    return { turnId: `t_${started.length}` }
  },
  liveTurn: () => null,
}))

/** Wall clock and the timer queue move independently, which is what sleep is. */
function sleepableClock(start: number) {
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

  async function run(): Promise<void> {
    let ran = true
    while (ran) {
      ran = false
      for (const [id, task] of [...pending].sort((a, b) => a[1].at - b[1].at)) {
        if (task.at <= now) {
          pending.delete(id)
          task.fn()
          ran = true
          await Promise.resolve()
          await Promise.resolve()
          await Promise.resolve()
        }
      }
    }
  }

  return {
    clock,
    async advance(ms: number) {
      now += ms
      await run()
    },
    /** The lid closes: wall clock jumps and no timer gets to run. */
    async sleep(ms: number) {
      now += ms
      await run()
    },
  }
}

let db: Db

/** 22:00 local, so an eight hour sleep lands the far side of a 09:00 slot. */
const EVENING = new Date(2026, 10, 4, 22, 0, 0, 0).getTime()

beforeEach(() => {
  started.length = 0
  const dir = mkdtempSync(join(tmpdir(), 'herbie-wake-'))
  db = openDb(join(dir, 'herbie.sqlite')).db
  db.insert(agents)
    .values({
      id: 'scout',
      name: 'Scout',
      acpAgent: 'codex',
      workspaceDir: '/tmp/scout',
    })
    .run()
  // Quiet hours off, explicitly. This file is about waking, and the
  // overnight window would otherwise silence the very hours it tests.
  db.insert(settings).values({ key: QUIET_HOURS_KEY, value: '' }).run()
  db.insert(routines)
    .values({
      id: 'r1',
      agentId: 'scout',
      name: 'Hourly check',
      cadence: 'every hour',
      // Every hour on the hour: an overnight sleep passes ten of these.
      cron: '0 * * * *',
      prompt: 'Check the thing.',
    })
    .run()
})

describe('a laptop closed overnight', () => {
  test('wakes in one pass rather than replaying every missed deadline', async () => {
    const t = sleepableClock(EVENING)
    let passes = 0
    const loop = startLoop(db, {
      intervalMs: 30_000,
      clock: t.clock,
      onPass: () => {
        passes += 1
      },
    })

    await t.sleep(10 * 60 * 60 * 1000)
    await t.advance(0)

    // Measured, not assumed: removing the re-anchor makes this 1,200,
    // because every missed deadline is already in the past and fires at
    // once. Each of those is a full scan and drain against the database on
    // a machine that has only just woken up.
    expect(passes).toBe(1)
    loop.stop()
  })

  test('runs a slot once even when a pass is repeated over it', async () => {
    const t = sleepableClock(EVENING)
    const loop = startLoop(db, { intervalMs: 30_000, clock: t.clock })

    // The protection that stops a routine running twice is the unique index
    // on the slot, not the re-anchor above. Worth its own test, because the
    // two are separate and it would be easy to believe one covers both.
    await t.advance(60 * 60 * 1000)
    const after = db.select().from(routineRuns).all().length
    loop.tick(t.clock.now())
    loop.tick(t.clock.now())

    expect(db.select().from(routineRuns).all().length).toBe(after)
    loop.stop()
  })

  test('keeps working on the far side of the sleep', async () => {
    const t = sleepableClock(EVENING)
    const loop = startLoop(db, { intervalMs: 30_000, clock: t.clock })

    await t.sleep(10 * 60 * 60 * 1000)
    await t.advance(30_000)
    const afterWake = db.select().from(routineRuns).all().length

    // 09:00 the next morning, reached normally rather than through the gap.
    await t.advance(60 * 60 * 1000)

    // The pulse survived the sleep: it is still finding and running work.
    expect(db.select().from(routineRuns).all().length).toBeGreaterThan(
      afterWake,
    )
    expect(started.length).toBeGreaterThan(0)
    loop.stop()
  })

  test('does not mistake the silence for a wedged agent', async () => {
    const t = sleepableClock(EVENING)
    const loop = startLoop(db, { intervalMs: 30_000, clock: t.clock })

    // Give the agent a run to hold, so there is a subject being watched.
    await t.advance(60 * 60 * 1000)
    expect(started.length).toBeGreaterThan(0)

    const before = db
      .select()
      .from(routineRuns)
      .all()
      .filter((row) => row.state === 'running').length

    // Hours with no feed at all. The watchdog deadline is 60s, so without
    // the wake handling every subject would be declared wedged here.
    await t.sleep(10 * 60 * 60 * 1000)
    await t.advance(30_000)

    // The held run is still held: nothing was torn down over the sleep.
    const after = db
      .select()
      .from(routineRuns)
      .all()
      .filter((row) => row.state === 'running').length
    expect(after).toBe(before)

    loop.stop()
  })
})
