import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publish } from '@bun/modules/conversation/bus'
import type { Db } from '@bun/modules/db/db'
import { openDb } from '@bun/modules/db/db'
import {
  agents,
  routineRuns,
  routines,
  settings,
} from '@bun/modules/db/schema/schema'
import { QUIET_HOURS_KEY, startLoop } from '@bun/modules/loop/loop'
import { eq } from 'drizzle-orm'

/**
 * What happens to a run while its turn is still going.
 *
 * Every test here covers a bug that shipped in the first version of this
 * loop and was found in review. The lease was renewed only for agents the
 * drain happened to visit, the watchdog was fed by the loop's own tick
 * rather than by the agent, and a run was started even after the person had
 * switched its routine off.
 */

const started: string[] = []
let live: string | null = null
let cancelled: string[] = []

mock.module('@bun/modules/conversation/turns', () => ({
  startTurn: (_db: Db, agentId: string, text: string) => {
    live = agentId
    started.push(text)
    return { turnId: `t_${started.length}` }
  },
  liveTurn: (agentId: string) => (live === agentId ? { turnId: 't' } : null),
  cancelTurn: (agentId: string) => {
    cancelled.push(agentId)
    live = null
    return true
  },
}))

let db: Db
/** 09:00, outside the default quiet window. */
const NINE = new Date(2026, 10, 4, 9, 0, 0, 0).getTime()

function seed(cron = '0 9 * * *') {
  db.insert(agents)
    .values({
      id: 'scout',
      name: 'Scout',
      acpAgent: 'codex',
      workspaceDir: '/tmp/scout',
    })
    .run()
  db.insert(routines)
    .values({
      id: 'r1',
      agentId: 'scout',
      name: 'Daily',
      cadence: 'every day at 9',
      cron,
      prompt: 'Do the thing.',
    })
    .run()
}

beforeEach(() => {
  started.length = 0
  cancelled = []
  live = null
  const dir = mkdtempSync(join(tmpdir(), 'herbie-upkeep-'))
  db = openDb(join(dir, 'herbie.sqlite')).db
  seed()
})

describe('a turn that is still running', () => {
  test('keeps its lease even when nothing else is queued', () => {
    const loop = startLoop(db, { autoStart: false })
    loop.tick(NINE)

    const claimed = db.select().from(routineRuns).all()[0]?.leaseUntil
    expect(claimed).not.toBeNull()

    // Five minutes of ticks with one daily routine, so there is never any
    // other queued work to pull this agent into the drain. This is the case
    // the original code never renewed, because upkeep hung off the drain.
    for (let n = 1; n <= 10; n += 1) {
      publish('scout', { type: 'turn', live: null })
      loop.tick(NINE + n * 30_000)
    }

    const renewed = db.select().from(routineRuns).all()[0]?.leaseUntil
    expect(renewed).not.toBe(claimed ?? '')
    loop.stop()
  })

  test('is not called wedged while the agent is still producing', () => {
    const loop = startLoop(db, { autoStart: false })
    loop.tick(NINE)

    // Progress on the bus, which is the agent doing something, every tick.
    for (let n = 1; n <= 10; n += 1) {
      publish('scout', { type: 'turn', live: null })
      loop.tick(NINE + n * 30_000)
    }

    expect(cancelled).toEqual([])
    expect(db.select().from(routineRuns).all()[0]?.state).toBe('running')
    loop.stop()
  })

  test('is cancelled once it stops producing anything at all', () => {
    const loop = startLoop(db, { autoStart: false })
    loop.tick(NINE)

    // No bus traffic: the turn is hung inside the runtime. Past the 60s
    // deadline the loop has to take the session back, because clearing its
    // own bookkeeping would leave the turn live and block the agent.
    for (let n = 1; n <= 6; n += 1) loop.tick(NINE + n * 30_000)

    expect(cancelled).toEqual(['scout'])
    loop.stop()
  })
})

describe('turning a routine off', () => {
  test('stops a slot that was already queued', () => {
    const loop = startLoop(db, { autoStart: false })

    live = 'scout' // busy, so the slot is queued rather than claimed
    loop.tick(NINE)
    expect(started).toHaveLength(0)

    db.update(routines)
      .set({ enabled: false })
      .where(eq(routines.id, 'r1'))
      .run()

    live = null
    loop.tick(NINE + 30_000)

    // It must not run. The switch means stop, including for work that was
    // already waiting when it was flipped.
    expect(started).toHaveLength(0)
    expect(db.select().from(routineRuns).all()[0]?.state).toBe('skipped')
    loop.stop()
  })
})

describe('quiet hours', () => {
  test('are on by default, as the panel has always said', () => {
    const loop = startLoop(db, { autoStart: false })
    // 02:00, inside the promised window, with nothing configured anywhere.
    loop.tick(new Date(2026, 10, 4, 2, 0, 0, 0).getTime())

    db.update(routines)
      .set({ cron: '0 2 * * *' })
      .where(eq(routines.id, 'r1'))
      .run()
    loop.tick(new Date(2026, 10, 5, 2, 0, 0, 0).getTime())

    expect(started).toHaveLength(0)
    const rows = db.select().from(routineRuns).all()
    expect(rows.every((row) => row.state === 'skipped')).toBe(true)
    loop.stop()
  })

  test('can be turned off explicitly, which is not the same as unset', () => {
    db.insert(settings).values({ key: QUIET_HOURS_KEY, value: '' }).run()
    db.update(routines)
      .set({ cron: '0 2 * * *' })
      .where(eq(routines.id, 'r1'))
      .run()

    const loop = startLoop(db, { autoStart: false })
    loop.tick(new Date(2026, 10, 4, 2, 0, 0, 0).getTime())

    expect(started).toHaveLength(1)
    loop.stop()
  })
})
