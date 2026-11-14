import { createLogger } from '@bun/lib/log'
import { subscribe } from '@bun/modules/conversation/bus'
import {
  cancelTurn,
  liveTurn,
  startTurn,
} from '@bun/modules/conversation/turns'
import type { Db } from '@bun/modules/db/db'
import { agents, routines } from '@bun/modules/db/schema/schema'
import {
  advance,
  allows,
  BREAKER_THRESHOLD,
  type BreakerState,
  CLOSED,
  onCancelled,
  onFailure,
  onSuccess,
  PARK_AFTER,
  reset,
} from '@bun/modules/loop/breaker'
import {
  type Clock,
  type Heartbeat,
  startHeartbeat,
  type Tick,
} from '@bun/modules/loop/heartbeat'
import {
  attachTurn,
  claimNext,
  prune,
  recentFailures,
  recoverOrphans,
  renew,
  runForTurn,
  settleRun,
  waitingAgents,
} from '@bun/modules/loop/queue'
import { scan } from '@bun/modules/loop/scan'
import { createWatchdog } from '@bun/modules/loop/watchdog'

export { QUIET_HOURS_KEY } from '@bun/modules/loop/scan'

const KEEP_RUNS_MS = 14 * 24 * 60 * 60 * 1000

export interface Loop {
  stop: () => void
  /** Puts a parked agent back to work, for the person who fixed the cause. */
  revive: (agentId: string) => void
  /** For tests and for the live soak: run one pass by hand. */
  tick: (at: number) => void
  stateOf: (agentId: string) => BreakerState
}

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

export function startLoop(
  db: Db,
  options: {
    readonly intervalMs?: number
    readonly autoStart?: boolean
    /** Injected so a test can drive a real sleep past a real pass. */
    readonly clock?: Clock
    /** Called on every pass, so a test can count them. */
    readonly onPass?: (tick: Tick) => void
    /** Told when an agent is given up on, which reaches no bus of its own. */
    readonly onPark?: (agentId: string) => void
  } = {},
): Loop {
  const breakers = new Map<string, BreakerState>()
  const dog = createWatchdog()
  const held = new Map<string, string>()
  /** Agents this loop cancelled for not progressing, so settle can tell. */
  const wedged = new Set<string>()
  let lastPruneAt = 0

  const stateOf = (agentId: string): BreakerState =>
    breakers.get(agentId) ?? CLOSED

  // Boot is the one moment every lease is known stale. Requeue rather than
  // wait it out: a 24x7 process may not restart again for weeks.
  recoverOrphans(db)

  // A park is a safety decision, and it must not be undone by a restart.
  // Reconstructed from the ledger rather than persisted separately, so there
  // is no second copy of the streak to keep in step with the first.
  for (const agent of db.select().from(agents).all()) {
    const streak = recentFailures(db, agent.id)
    if (streak >= PARK_AFTER * BREAKER_THRESHOLD) {
      breakers.set(agent.id, {
        phase: 'parked',
        streak,
        trips: PARK_AFTER,
        openedAt: Date.now(),
        retryAt: null,
      })
      log.warn('agent is still parked from before the restart', {
        agent: agent.id,
        failures: streak,
      })
    }
  }

  /**
   * Closes the run a finished turn belonged to.
   *
   * Subscribed rather than polled, and scoped to turns this loop started:
   * a turn the person began has no run row, so `runForTurn` finds nothing
   * and the breaker is left alone.
   */
  const settle = (
    agentId: string,
    runId: string,
    reason: 'stop' | 'cancel' | 'error',
  ): void => {
    held.delete(agentId)
    dog.forget(agentId)

    if (reason === 'stop') {
      settleRun(db, runId, 'done')
      breakers.set(agentId, onSuccess(stateOf(agentId)))
      return
    }
    if (reason === 'cancel') {
      // The person stopped it. Not the agent failing, so the streak stands.
      settleRun(db, runId, 'failed', 'cancelled')
      breakers.set(agentId, onCancelled(stateOf(agentId)))
      return
    }

    settleRun(db, runId, 'failed', 'the turn ended in error')
    const next = onFailure(stateOf(agentId), Date.now())
    breakers.set(agentId, next)
    if (next.phase === 'parked') {
      log.warn('agent parked after repeated failures', { agent: agentId })
      options.onPark?.(agentId)
    }
  }

  /**
   * Watches one agent, for progress and for the end of its turn.
   *
   * The watchdog is fed from here rather than from the pass, which is the
   * correction that makes it a watchdog at all. Feeding it on the loop's own
   * tick proved only that the loop was running: a turn wedged inside acpx
   * would have been renewed forever by the very thing meant to notice it.
   * Every signal on this bus is the agent doing something, so this is the
   * evidence the deadline should be measured against.
   */
  const watch = (agentId: string): (() => void) =>
    subscribe(agentId, (signal) => {
      dog.feed(agentId, Date.now())

      if (signal.type !== 'record') return
      const record = signal.record
      if (record.kind !== 'turn.end') return

      const run = runForTurn(db, record.turn)
      if (!run) return
      // A cancel this loop asked for is a failure, not the person stopping
      // work. Without this a wedged agent would clear its own streak.
      const reason = wedged.has(agentId) ? 'error' : record.reason
      wedged.delete(agentId)
      settle(agentId, run.id, reason)
    })

  const watchers = new Map<string, () => void>()

  /** Whether this agent can be handed work right now. */
  const readyFor = (agentId: string, at: number): boolean => {
    const before = stateOf(agentId)
    const state = advance(before, at)
    if (state !== before) breakers.set(agentId, state)
    if (!allows(state, at)) return false

    // Upkeep deliberately does not live here. This is reached only for
    // agents the drain found work for, and an agent with a healthy run in
    // flight and nothing queued behind it is not one of them, so renewing
    // from here left the common case never renewed at all.
    if (held.has(agentId)) return false
    return liveTurn(agentId) === null
  }

  /**
   * Keeps alive what this loop is holding, and gives up on what is not.
   *
   * Runs on every pass over every held run, rather than only over agents the
   * drain happens to visit. A lease renewed only when other work is queued
   * is a lease that lapses under exactly the turn it exists to protect.
   */
  const upkeep = (at: number): void => {
    for (const [agentId, runId] of [...held]) {
      if (dog.wedged(at).includes(agentId)) continue
      renew(db, runId, at)
    }

    for (const agentId of dog.wedged(at)) {
      const runId = held.get(agentId)
      if (runId === undefined) continue

      // Stop renewing and take the session back. Clearing the bookkeeping
      // alone would leave the hung turn live, and every later pass would
      // refuse to claim for this agent because a turn was still running.
      log.warn('agent stopped making progress, cancelling its turn', {
        agent: agentId,
      })
      wedged.add(agentId)
      held.delete(agentId)
      dog.forget(agentId)
      if (!cancelTurn(agentId, 'no progress')) {
        // Nothing to cancel, so nothing will settle the row either.
        settleRun(db, runId, 'failed', 'stopped making progress')
        wedged.delete(agentId)
        breakers.set(agentId, onFailure(stateOf(agentId), at))
      }
    }
  }

  const startOne = (agentId: string, at: number): void => {
    const run = claimNext(db, agentId, at)
    if (!run) return

    const routine = db
      .select()
      .from(routines)
      .where(eq(routines.id, run.routineId))
      .get()
    if (!routine) {
      settleRun(db, run.id, 'failed', 'the routine was deleted')
      return
    }
    // Checked here and not only at scan time. A slot enqueued while the
    // agent was busy would otherwise still run after the person switched
    // the routine off, which is the opposite of what the switch means.
    if (!routine.enabled) {
      settleRun(db, run.id, 'skipped', 'the routine was turned off')
      return
    }

    try {
      const { turnId } = startTurn(db, agentId, routine.prompt)
      attachTurn(db, run.id, turnId)
      held.set(agentId, run.id)
      dog.feed(agentId, at)
      if (!watchers.has(agentId)) watchers.set(agentId, watch(agentId))
      log.info('routine started', { routine: routine.id, agent: agentId })
    } catch (cause) {
      // Busy after all, or unreachable. Recorded rather than lost: the slot
      // keeps its row and the breaker counts the failure.
      settleRun(db, run.id, 'failed', String(cause))
      breakers.set(agentId, onFailure(stateOf(agentId), at))
    }
  }

  const drain = (at: number): void => {
    for (const agentId of waitingAgents(db, at)) {
      if (readyFor(agentId, at)) startOne(agentId, at)
    }
  }

  const pass = (tick: Tick): void => {
    options.onPass?.(tick)

    // A closed lid stops every feed for hours and that is healthy, so the
    // deadlines move with the clock rather than declaring everything wedged.
    if (tick.slept !== null) {
      dog.slept(tick.at)
      log.info('woke after a gap, re-anchored', { sleptMs: tick.slept })
    }

    upkeep(tick.at)
    scan(db, tick.at)
    drain(tick.at)

    if (tick.at - lastPruneAt > 60 * 60 * 1000) {
      lastPruneAt = tick.at
      prune(db, tick.at - KEEP_RUNS_MS)
    }
  }

  let beat: Heartbeat | null = null
  if (options.autoStart !== false) {
    beat = startHeartbeat(pass, {
      intervalMs: options.intervalMs,
      ...(options.clock ? { clock: options.clock } : {}),
    })
    log.info('loop started', { agents: db.select().from(agents).all().length })
  }

  return {
    /**
     * Clears a park, which nothing else can do.
     *
     * The person is the only one who knows the cause is fixed, so this is
     * reached from them turning a routine back on rather than from a timer.
     * Recovering on a clock would just park again on the next failure.
     */
    revive(agentId) {
      if (stateOf(agentId).phase !== 'parked') return
      breakers.set(agentId, reset())
      log.info('agent revived', { agent: agentId })
    },
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
