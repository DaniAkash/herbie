import { beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Db } from '@bun/modules/db/db'
import { openDb } from '@bun/modules/db/db'
import { agents, routineRuns, routines } from '@bun/modules/db/schema/schema'
import {
  attachTurn,
  claimNext,
  enqueue,
  LEASE_MS,
  prune,
  recoverOrphans,
  renew,
  runForTurn,
  settleRun,
  waitingAgents,
} from '@bun/modules/loop/queue'
import { eq } from 'drizzle-orm'

let db: Db
const AT = Date.parse('2026-11-04T09:00:00.000Z')
const SLOT = '2026-11-04T09:00:00.000Z'

function seed(agentId = 'scout', routineId = 'r1') {
  db.insert(agents)
    .values({
      id: agentId,
      name: agentId,
      acpAgent: 'codex',
      workspaceDir: `/tmp/${agentId}`,
    })
    .run()
  db.insert(routines)
    .values({
      id: routineId,
      agentId,
      name: 'Morning notifications',
      cadence: 'every weekday at 9',
      cron: '0 9 * * 1-5',
      prompt: 'Check notifications.',
    })
    .run()
}

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'herbie-queue-'))
  db = openDb(join(dir, 'herbie.sqlite')).db
  seed()
})

describe('enqueueing a slot', () => {
  test('inserts once however many times the tick runs', () => {
    expect(
      enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT }),
    ).toBe(true)
    // The same minute scanned again, which overlapping ticks will do.
    expect(
      enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT }),
    ).toBe(false)

    const rows = db.select().from(routineRuns).all()
    expect(rows).toHaveLength(1)
  })

  test('a different slot is a different run', () => {
    enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT })
    enqueue(db, {
      routineId: 'r1',
      agentId: 'scout',
      dueAt: '2026-11-05T09:00:00.000Z',
    })
    expect(db.select().from(routineRuns).all()).toHaveLength(2)
  })

  test('a skipped slot is recorded, not queued', () => {
    enqueue(db, {
      routineId: 'r1',
      agentId: 'scout',
      dueAt: SLOT,
      state: 'skipped',
    })
    expect(claimNext(db, 'scout', AT)).toBeNull()
    expect(db.select().from(routineRuns).all()[0]?.state).toBe('skipped')
  })
})

describe('claiming a run', () => {
  test('gives it to one caller and nobody else', () => {
    enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT })

    const first = claimNext(db, 'scout', AT)
    const second = claimNext(db, 'scout', AT)

    expect(first?.routineId).toBe('r1')
    expect(first?.attempt).toBe(1)
    // The second pass over the same tick must come away with nothing.
    expect(second).toBeNull()
  })

  test('hands back a run whose lease lapsed', () => {
    enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT })
    const first = claimNext(db, 'scout', AT)
    expect(first).not.toBeNull()

    // The holder wedged and stopped renewing. Without the lease this run
    // would be lost until the process restarted.
    const later = AT + LEASE_MS + 1000
    const reclaimed = claimNext(db, 'scout', later)

    expect(reclaimed?.id).toBe(first?.id ?? '')
    expect(reclaimed?.attempt).toBe(2)
  })

  test('a renewed lease is not reclaimable', () => {
    enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT })
    const run = claimNext(db, 'scout', AT)
    expect(run).not.toBeNull()
    if (!run) return

    const later = AT + LEASE_MS - 1000
    renew(db, run.id, later)

    expect(claimNext(db, 'scout', later + 2000)).toBeNull()
  })

  test('lets a person go ahead of a scheduled report', () => {
    enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT })
    enqueue(db, {
      routineId: 'r1',
      agentId: 'scout',
      // Later slot, but a person is waiting on it.
      dueAt: '2026-11-04T10:00:00.000Z',
      source: 'person',
    })

    expect(claimNext(db, 'scout', AT)?.source).toBe('person')
  })

  test('claims nothing for an agent with nothing waiting', () => {
    expect(claimNext(db, 'scout', AT)).toBeNull()
  })
})

describe('settling a run', () => {
  test('matches a turn back to its run, then closes it', () => {
    enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT })
    const run = claimNext(db, 'scout', AT)
    expect(run).not.toBeNull()
    if (!run) return

    attachTurn(db, run.id, 't_abc')
    expect(runForTurn(db, 't_abc')?.id).toBe(run.id)

    settleRun(db, run.id, 'done')
    expect(runForTurn(db, 't_abc')).toBeNull()

    const row = db
      .select()
      .from(routineRuns)
      .where(eq(routineRuns.id, run.id))
      .get()
    expect(row?.state).toBe('done')
    expect(row?.leaseUntil).toBeNull()
  })

  test('records why a run failed', () => {
    enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT })
    const run = claimNext(db, 'scout', AT)
    if (!run) return

    settleRun(db, run.id, 'failed', 'the agent could not be reached')
    const row = db
      .select()
      .from(routineRuns)
      .where(eq(routineRuns.id, run.id))
      .get()
    expect(row?.state).toBe('failed')
    expect(row?.error).toBe('the agent could not be reached')
  })
})

describe('after a crash', () => {
  test('puts back every run the dead process was holding', () => {
    enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT })
    const run = claimNext(db, 'scout', AT)
    if (!run) return
    attachTurn(db, run.id, 't_gone')

    // The process died here. Nothing renews, and on a 24x7 loop waiting out
    // the lease could mean the routine is simply late by two minutes.
    expect(recoverOrphans(db)).toBe(1)

    const back = claimNext(db, 'scout', AT)
    expect(back?.id).toBe(run.id)
    // The attempt count survives, so a crash loop cannot retry forever.
    expect(back?.attempt).toBe(2)
  })
})

describe('housekeeping', () => {
  test('lists only agents with something waiting', () => {
    expect(waitingAgents(db, AT)).toEqual([])
    enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT })
    expect(waitingAgents(db, AT)).toEqual(['scout'])
  })

  test('prunes finished rows and keeps live ones', () => {
    enqueue(db, { routineId: 'r1', agentId: 'scout', dueAt: SLOT })
    const run = claimNext(db, 'scout', AT)
    if (!run) return
    settleRun(db, run.id, 'done')
    enqueue(db, {
      routineId: 'r1',
      agentId: 'scout',
      dueAt: '2026-11-05T09:00:00.000Z',
    })

    expect(prune(db, Date.now() + 60_000)).toBe(1)
    expect(db.select().from(routineRuns).all()).toHaveLength(1)
  })
})
