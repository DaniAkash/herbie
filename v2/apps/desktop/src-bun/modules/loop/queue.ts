import { createLogger } from '@bun/lib/log'
import type { Db } from '@bun/modules/db/db'
import { routineRuns } from '@bun/modules/db/schema/schema'
import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm'

const log = createLogger('loop')

/**
 * The run queue: what is waiting, who holds it, and what to start next.
 *
 * A due routine is never dropped because its agent was busy. It waits here
 * until the agent is free, which is also why this is the mechanism a
 * person's message needs when it arrives mid-turn: the same row with a
 * different `source`.
 */

export type RunSource = 'routine' | 'person'

export interface QueuedRun {
  readonly id: string
  readonly routineId: string
  readonly agentId: string
  readonly source: string
  readonly attempt: number
}

/** Four ticks. Long enough that a slow turn is not stolen from itself. */
export const LEASE_MS = 120_000

function runId(): string {
  return `rr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Puts a routine's slot on the queue, once.
 *
 * The unique index on (routine_id, due_at) is what makes this idempotent, so
 * a tick that runs twice across the same minute inserts one row rather than
 * two. Returns whether this call is the one that created it.
 */
export function enqueue(
  db: Db,
  input: {
    readonly routineId: string
    readonly agentId: string
    readonly dueAt: string
    readonly source?: RunSource
    readonly state?: 'queued' | 'skipped'
  },
): boolean {
  const written = db
    .insert(routineRuns)
    .values({
      id: runId(),
      routineId: input.routineId,
      agentId: input.agentId,
      dueAt: input.dueAt,
      source: input.source ?? 'routine',
      state: input.state ?? 'queued',
    })
    .onConflictDoNothing()
    .returning()
    .get()

  return written !== undefined
}

/**
 * The next run an agent should start, claimed so nobody else starts it.
 *
 * A conditional UPDATE rather than a read and then a write, so two passes
 * over the same tick cannot both win it. The second condition is the lease:
 * a run whose holder stopped renewing is reclaimable without waiting for a
 * restart, which turns a wedge from a permanent loss into a late run.
 *
 * Person-sourced work sorts first. Somebody waiting on a reply should not
 * sit behind a scheduled report.
 */
export function claimNext(
  db: Db,
  agentId: string,
  at: number,
): QueuedRun | null {
  const now = new Date(at).toISOString()
  const candidate = db
    .select()
    .from(routineRuns)
    .where(
      and(
        eq(routineRuns.agentId, agentId),
        or(
          eq(routineRuns.state, 'queued'),
          and(
            eq(routineRuns.state, 'running'),
            lt(routineRuns.leaseUntil, now),
          ),
        ),
      ),
    )
    .orderBy(
      // 'person' sorts before 'routine' alphabetically, which is a happy
      // accident rather than a plan, so it is spelled out instead.
      sql`case ${routineRuns.source} when 'person' then 0 else 1 end`,
      asc(routineRuns.dueAt),
    )
    .limit(1)
    .get()

  if (!candidate) return null

  const claimed = db
    .update(routineRuns)
    .set({
      state: 'running',
      claimedAt: now,
      leaseUntil: new Date(at + LEASE_MS).toISOString(),
      attempt: sql`${routineRuns.attempt} + 1`,
    })
    .where(
      and(
        eq(routineRuns.id, candidate.id),
        or(
          eq(routineRuns.state, 'queued'),
          and(
            eq(routineRuns.state, 'running'),
            lt(routineRuns.leaseUntil, now),
          ),
        ),
      ),
    )
    .returning()
    .get()

  // Empty means another pass took it between the read and the update, which
  // is exactly what the condition is for.
  if (!claimed) return null

  return {
    id: claimed.id,
    routineId: claimed.routineId,
    agentId: claimed.agentId,
    source: claimed.source,
    attempt: claimed.attempt,
  }
}

/** Says the holder is still working, so the lease does not lapse under it. */
export function renew(db: Db, runId: string, at: number): void {
  db.update(routineRuns)
    .set({ leaseUntil: new Date(at + LEASE_MS).toISOString() })
    .where(and(eq(routineRuns.id, runId), eq(routineRuns.state, 'running')))
    .run()
}

/** Ties a claimed run to the turn it started, so `turn.end` can find it. */
export function attachTurn(db: Db, runId: string, turnId: string): void {
  db.update(routineRuns).set({ turnId }).where(eq(routineRuns.id, runId)).run()
}

export function settleRun(
  db: Db,
  runId: string,
  state: 'done' | 'failed' | 'skipped',
  error?: string,
): void {
  db.update(routineRuns)
    .set({ state, leaseUntil: null, ...(error ? { error } : {}) })
    .where(eq(routineRuns.id, runId))
    .run()
}

/** The run a turn belongs to, or nothing when the turn was a person's. */
export function runForTurn(db: Db, turnId: string): QueuedRun | null {
  const row = db
    .select()
    .from(routineRuns)
    .where(
      and(eq(routineRuns.turnId, turnId), eq(routineRuns.state, 'running')),
    )
    .get()
  if (!row) return null
  return {
    id: row.id,
    routineId: row.routineId,
    agentId: row.agentId,
    source: row.source,
    attempt: row.attempt,
  }
}

/** Agents with anything waiting, so the drain does not scan every agent. */
export function waitingAgents(db: Db, at: number): string[] {
  const now = new Date(at).toISOString()
  const rows = db
    .selectDistinct({ agentId: routineRuns.agentId })
    .from(routineRuns)
    .where(
      or(
        eq(routineRuns.state, 'queued'),
        and(eq(routineRuns.state, 'running'), lt(routineRuns.leaseUntil, now)),
      ),
    )
    .all()
  return rows.map((row) => row.agentId)
}

/**
 * Hands back any run left claimed by a process that is no longer here.
 *
 * Boot is the one moment every lease is guaranteed stale, because nothing
 * has renewed since the last shutdown. Rather than wait out the lease, every
 * run still marked running is put back on the queue, and the attempt count
 * it already carries is what stops a crash loop retrying forever.
 */
export function recoverOrphans(db: Db): number {
  const rows = db
    .update(routineRuns)
    .set({ state: 'queued', leaseUntil: null, claimedAt: null, turnId: null })
    .where(eq(routineRuns.state, 'running'))
    .returning()
    .all()

  if (rows.length > 0) {
    log.info('requeued runs left claimed by a previous process', {
      count: rows.length,
    })
  }
  return rows.length
}

/** Drops finished rows older than the window, so the table stays small. */
export function prune(db: Db, before: number): number {
  const rows = db
    .delete(routineRuns)
    .where(
      and(
        inArray(routineRuns.state, ['done', 'failed', 'skipped']),
        lt(routineRuns.createdAt, new Date(before).toISOString()),
      ),
    )
    .returning()
    .all()
  return rows.length
}

/**
 * How many of an agent's most recent runs failed, newest first.
 *
 * The breaker lives in memory, which means a restart would otherwise clear
 * a park and quietly reverse a safety decision. Reading the streak back off
 * the ledger is what makes the decision survive, without a second copy of
 * it to keep in step. Skipped runs are not judged: they never reached the
 * agent, so they are evidence of nothing.
 */
export function recentFailures(db: Db, agentId: string, limit = 5): number {
  const rows = db
    .select()
    .from(routineRuns)
    .where(
      and(
        eq(routineRuns.agentId, agentId),
        inArray(routineRuns.state, ['done', 'failed']),
      ),
    )
    .orderBy(desc(routineRuns.dueAt))
    .limit(limit)
    .all()

  let streak = 0
  for (const row of rows) {
    if (row.state !== 'failed') break
    streak += 1
  }
  return streak
}
