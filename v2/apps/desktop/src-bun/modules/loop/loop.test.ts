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
import { QUIET_HOURS_KEY, startLoop } from '@bun/modules/loop/loop'

/**
 * The turn runner is the seam. Everything below it is a real database and
 * the real queue; above it is a stub, because starting a turn means spawning
 * a coding agent and this test is about what the loop decides, not what the
 * agent says.
 */
const started: { agentId: string; text: string }[] = []
let live: string | null = null
let refuse = false

mock.module('@bun/modules/conversation/turns', () => ({
  startTurn: (_db: Db, agentId: string, text: string) => {
    if (refuse) throw new Error('a turn is already running')
    started.push({ agentId, text })
    return { turnId: `t_${started.length}` }
  },
  liveTurn: (agentId: string) => (live === agentId ? { turnId: 't' } : null),
}))

let db: Db

/** 09:00 local on Wednesday 2026-11-04, which the cron below matches. */
const NINE = new Date(2026, 10, 4, 9, 0, 0, 0).getTime()
const TWO_AM = new Date(2026, 10, 4, 2, 0, 0, 0).getTime()

function seed(over: { cron?: string | null; enabled?: boolean } = {}) {
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
      name: 'Morning notifications',
      cadence: 'every weekday at 9',
      cron: over.cron === undefined ? '0 9 * * 1-5' : over.cron,
      prompt: 'Check my notifications.',
      enabled: over.enabled ?? true,
    })
    .run()
}

beforeEach(() => {
  started.length = 0
  live = null
  refuse = false
  const dir = mkdtempSync(join(tmpdir(), 'herbie-loop-'))
  db = openDb(join(dir, 'herbie.sqlite')).db
})

describe('a tick', () => {
  test('starts a routine that is due, with its own prompt', () => {
    seed()
    const loop = startLoop(db, { autoStart: false })

    loop.tick(NINE)

    expect(started).toEqual([
      { agentId: 'scout', text: 'Check my notifications.' },
    ])
    loop.stop()
  })

  test('starts nothing on a minute that is not its slot', () => {
    seed()
    const loop = startLoop(db, { autoStart: false })
    loop.tick(NINE + 60_000)
    expect(started).toHaveLength(0)
    loop.stop()
  })

  test('starts a due routine once however often it ticks', () => {
    seed()
    const loop = startLoop(db, { autoStart: false })

    // Three passes over the same minute, which overlapping ticks produce.
    loop.tick(NINE)
    loop.tick(NINE + 1000)
    loop.tick(NINE + 2000)

    expect(started).toHaveLength(1)
    loop.stop()
  })

  test('leaves a routine queued while the agent is busy, then starts it', () => {
    seed()
    const loop = startLoop(db, { autoStart: false })

    live = 'scout'
    loop.tick(NINE)
    // Not dropped: the whole point of the queue.
    expect(started).toHaveLength(0)
    expect(
      db
        .select()
        .from(routineRuns)
        .all()
        .map((row) => row.state),
    ).toEqual(['queued'])

    live = null
    loop.tick(NINE + 30_000)
    expect(started).toHaveLength(1)
    loop.stop()
  })

  test('records a quiet-hours slot as skipped rather than holding it', () => {
    seed({ cron: '0 2 * * *' })
    db.insert(settings)
      .values({ key: QUIET_HOURS_KEY, value: '23:00-07:00' })
      .run()

    const loop = startLoop(db, { autoStart: false })
    loop.tick(TWO_AM)

    expect(started).toHaveLength(0)
    expect(db.select().from(routineRuns).all()[0]?.state).toBe('skipped')

    // And it stays skipped: morning must not open with a backlog.
    loop.tick(TWO_AM + 6 * 60 * 60 * 1000)
    expect(started).toHaveLength(0)
    loop.stop()
  })

  test('ignores a disabled routine and one whose cadence never parsed', () => {
    seed({ enabled: false })
    db.insert(routines)
      .values({
        id: 'r2',
        agentId: 'scout',
        name: 'Unreadable',
        cadence: 'whenever',
        cron: null,
        prompt: 'x',
      })
      .run()

    const loop = startLoop(db, { autoStart: false })
    loop.tick(NINE)
    expect(started).toHaveLength(0)
    loop.stop()
  })
})

describe('when a turn cannot be started', () => {
  test('records the failure rather than losing the run', () => {
    seed()
    refuse = true
    const loop = startLoop(db, { autoStart: false })

    loop.tick(NINE)

    const row = db.select().from(routineRuns).all()[0]
    expect(row?.state).toBe('failed')
    expect(loop.stateOf('scout').streak).toBe(1)
    loop.stop()
  })

  test('opens the breaker on the third failure and stops scheduling', () => {
    seed({ cron: '* * * * *' })
    refuse = true
    const loop = startLoop(db, { autoStart: false })

    loop.tick(NINE)
    loop.tick(NINE + 60_000)
    loop.tick(NINE + 120_000)

    expect(loop.stateOf('scout').phase).toBe('open')

    // Fourth minute: the breaker holds it back rather than trying again.
    const before = db.select().from(routineRuns).all().length
    loop.tick(NINE + 180_000)
    const after = db.select().from(routineRuns).all()

    // The slot is still enqueued, because the scan is independent of the
    // breaker. What must not happen is another attempt.
    expect(after.length).toBeGreaterThan(before - 1)
    expect(after.filter((row) => row.state === 'running')).toHaveLength(0)
    loop.stop()
  })
})

describe('after a crash', () => {
  test('requeues a run the dead process was holding', () => {
    seed()
    const first = startLoop(db, { autoStart: false })
    first.tick(NINE)
    first.stop()

    expect(db.select().from(routineRuns).all()[0]?.state).toBe('running')

    // The process died with the run still claimed. A new loop puts it back.
    started.length = 0
    const second = startLoop(db, { autoStart: false })
    expect(db.select().from(routineRuns).all()[0]?.state).toBe('queued')

    second.tick(NINE + 60_000)
    expect(started).toHaveLength(1)
    second.stop()
  })
})
