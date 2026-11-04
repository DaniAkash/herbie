import { createLogger } from '@bun/lib/log'
import { subscribe } from '@bun/modules/conversation/bus'
import { liveTurn, startTurn } from '@bun/modules/conversation/turns'
import type { Db } from '@bun/modules/db/db'
import { agents, routines, settings } from '@bun/modules/db/schema/schema'
import {
  advance,
  allows,
  type BreakerState,
  CLOSED,
  onCancelled,
  onFailure,
  onSuccess,
} from '@bun/modules/loop/breaker'
import {
  type Heartbeat,
  startHeartbeat,
  type Tick,
} from '@bun/modules/loop/heartbeat'
import {
  attachTurn,
  claimNext,
  enqueue,
  prune,
  recoverOrphans,
  renew,
  runForTurn,
  settleRun,
  waitingAgents,
} from '@bun/modules/loop/queue'
import {
  parseQuietHours,
  type QuietHours,
  slotOf,
  verdictFor,
} from '@bun/modules/loop/schedule'
import { createWatchdog } from '@bun/modules/loop/watchdog'
import { eq } from 'drizzle-orm'

const log = createLogger('loop')

/**
 * The one place the tick, the schedule, the queue and the breaker meet.
 *
 * Everything above is a pure function or a table; this is the part with the
 * side effects, deliberately kept to one file so the ordering is readable in
 * one sitting. It does not run a turn itself: `startTurn` is already the
 * only way a turn begins, and a second runner would mean two sessions per
 * agent and two transcripts to reconcile.
 */

export const QUIET_HOURS_KEY = 'loop.quietHours'
/** Finished rows older than this are dropped, so the ledger stays small. */
const KEEP_RUNS_MS = 14 * 24 * 60 * 60 * 1000

export interface Loop {
  stop: () => void
  /** For tests and for the live soak: run one pass by hand. */
  tick: (at: number) => void
  stateOf: (agentId: string) => BreakerState
}

function quietHours(db: Db): QuietHours | null {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, QUIET_HOURS_KEY))
    .get()
  return parseQuietHours(row?.value ?? null)
}

/**
 * Enqueues whatever this minute owes, once.
 *
 * Quiet hours record a skipped row rather than holding the work, because a
 * report about this morning delivered at seven is useful and eight overnight
 * reports delivered at once are not.
 */
function scan(db: Db, at: number): void {
  const quiet = quietHours(db)
  const slot = slotOf(at)

  for (const routine of db.select().from(routines).all()) {
    const verdict = verdictFor(
      {
        id: routine.id,
        agentId: routine.agentId,
        cron: routine.cron,
        enabled: routine.enabled,
        kind: routine.kind,
      },
      at,
      quiet,
    )
    if (verdict === 'not-due') continue

    const created = enqueue(db, {
      routineId: routine.id,
      agentId: routine.agentId,
      dueAt: slot,
      state: verdict === 'quiet' ? 'skipped' : 'queued',
    })
    if (created) {
      log.info(
        verdict === 'quiet' ? 'routine skipped, quiet hours' : 'routine due',
        {
          routine: routine.id,
          agent: routine.agentId,
        },
      )
    }
  }
}

export function startLoop(
  db: Db,
  options: { readonly intervalMs?: number; readonly autoStart?: boolean } = {},
): Loop {
  const breakers = new Map<string, BreakerState>()
  const dog = createWatchdog()
  const held = new Map<string, string>()
  let lastPruneAt = 0

  const stateOf = (agentId: string): BreakerState =>
    breakers.get(agentId) ?? CLOSED

  // Boot is the one moment every lease is known stale. Requeue rather than
  // wait it out: a 24x7 process may not restart again for weeks.
  recoverOrphans(db)

  /**
   * Closes the run a finished turn belonged to.
   *
   * Subscribed rather than polled, and scoped to turns this loop started:
   * a turn the person began has no run row, so `runForTurn` finds nothing
   * and the breaker is left alone.
   */
  const watch = (agentId: string): (() => void) =>
    subscribe(agentId, (signal) => {
      if (signal.type !== 'record') return
      const record = signal.record
      if (record.kind !== 'turn.end') return

      const run = runForTurn(db, record.turn)
      if (!run) return

      held.delete(agentId)
      dog.forget(agentId)

      if (record.reason === 'stop') {
        settleRun(db, run.id, 'done')
        breakers.set(agentId, onSuccess(stateOf(agentId)))
        return
      }
      if (record.reason === 'cancel') {
        // The person stopped it. Not the agent failing, so the streak stands.
        settleRun(db, run.id, 'failed', 'cancelled')
        breakers.set(agentId, onCancelled(stateOf(agentId)))
        return
      }
      settleRun(db, run.id, 'failed', 'the turn ended in error')
      const next = onFailure(stateOf(agentId), Date.now())
      breakers.set(agentId, next)
      if (next.phase === 'parked') {
        log.warn('agent parked after repeated failures', { agent: agentId })
      }
    })

  const watchers = new Map<string, () => void>()

  const drain = (at: number): void => {
    for (const agentId of waitingAgents(db, at)) {
      const before = stateOf(agentId)
      const state = advance(before, at)
      if (state !== before) breakers.set(agentId, state)
      if (!allows(state, at)) continue

      // Already working. Renew what it holds so the lease does not lapse
      // under a turn that is genuinely running, and come back next tick.
      const running = held.get(agentId)
      if (running !== undefined) {
        renew(db, running, at)
        dog.feed(agentId, at)
        continue
      }
      if (liveTurn(agentId) !== null) continue

      const run = claimNext(db, agentId, at)
      if (!run) continue

      const routine = db
        .select()
        .from(routines)
        .where(eq(routines.id, run.routineId))
        .get()
      if (!routine) {
        settleRun(db, run.id, 'failed', 'the routine was deleted')
        continue
      }

      try {
        const { turnId } = startTurn(db, agentId, routine.prompt)
        attachTurn(db, run.id, turnId)
        held.set(agentId, run.id)
        dog.feed(agentId, at)
        if (!watchers.has(agentId)) watchers.set(agentId, watch(agentId))
        log.info('routine started', { routine: routine.id, agent: agentId })
      } catch (cause) {
        // The agent was busy after all, or could not be reached. Put it back
        // rather than losing it: the next tick will try again.
        settleRun(db, run.id, 'failed', String(cause))
        breakers.set(agentId, onFailure(stateOf(agentId), at))
      }
    }
  }

  const pass = (tick: Tick): void => {
    // A closed lid stops every feed for hours and that is healthy, so the
    // deadlines move with the clock rather than declaring everything wedged.
    if (tick.slept !== null) {
      dog.slept(tick.at)
      log.info('woke after a gap, re-anchored', { sleptMs: tick.slept })
    }

    scan(db, tick.at)
    drain(tick.at)

    for (const agentId of dog.wedged(tick.at)) {
      log.warn('agent stopped feeding, letting its lease lapse', {
        agent: agentId,
      })
      held.delete(agentId)
      dog.forget(agentId)
    }

    if (tick.at - lastPruneAt > 60 * 60 * 1000) {
      lastPruneAt = tick.at
      prune(db, tick.at - KEEP_RUNS_MS)
    }
  }

  let beat: Heartbeat | null = null
  if (options.autoStart !== false) {
    beat = startHeartbeat(pass, { intervalMs: options.intervalMs })
    log.info('loop started', { agents: db.select().from(agents).all().length })
  }

  return {
    stop() {
      beat?.stop()
      for (const off of watchers.values()) off()
      watchers.clear()
    },
    tick(at) {
      pass({ at, drift: 0, slept: null })
    },
    stateOf,
  }
}
