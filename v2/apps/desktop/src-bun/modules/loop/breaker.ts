/**
 * Whether an agent may be given work right now.
 *
 * A streak counter on its own is half a circuit breaker: it recycles and
 * then either works or immediately burns another three failures. The third
 * state is what makes it one. After the cooldown the agent is let through
 * once, and that probe is a real routine rather than a synthetic turn,
 * because a routine is already cheap and disposable.
 *
 * Plain functions over a plain object rather than a state machine library.
 * This is four states and two comparisons, and the whole of it fits on a
 * screen; a machine definition would be more indirection than guarantee.
 */

const BREAKER_THRESHOLD = 3
export const BREAKER_COOLDOWN_MS = 300_000
const PARK_AFTER = 3

const BACKOFF_BASE_MS = 1_000
export const BACKOFF_CAP_MS = 300_000

export type BreakerPhase = 'closed' | 'open' | 'half-open' | 'parked'

export interface BreakerState {
  readonly phase: BreakerPhase
  readonly streak: number
  readonly trips: number
  readonly openedAt: number | null
  /** Wall clock before which no work is started, from the backoff. */
  readonly retryAt: number | null
}

export const CLOSED: BreakerState = {
  phase: 'closed',
  streak: 0,
  trips: 0,
  openedAt: null,
  retryAt: null,
}

/**
 * Full jitter, which is the part that is easy to leave out.
 *
 * Several agents failing on one shared cause is not hypothetical here: a
 * single expired credential takes down every codex-backed agent at once.
 * Identical backoff curves would then retry in lockstep forever.
 */
export function backoffFor(
  attempt: number,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt)
  return Math.floor(random() * ceiling)
}

/**
 * Whether work may start, which is a question about this instant.
 *
 * Deadlines are compared against the tick rather than counted down by a
 * timer, because a timer armed before the lid closes fires late by the
 * whole sleep and has no way to know.
 */
export function allows(state: BreakerState, at: number): boolean {
  if (state.phase === 'parked') return false
  if (state.retryAt !== null && at < state.retryAt) return false
  if (state.phase === 'open') {
    return state.openedAt !== null && at >= state.openedAt + BREAKER_COOLDOWN_MS
  }
  return true
}

/** Moves open to half-open once its cooldown has passed, and nothing else. */
export function advance(state: BreakerState, at: number): BreakerState {
  if (
    state.phase === 'open' &&
    state.openedAt !== null &&
    at >= state.openedAt + BREAKER_COOLDOWN_MS
  ) {
    return { ...state, phase: 'half-open' }
  }
  return state
}

export function onSuccess(state: BreakerState): BreakerState {
  if (state.phase === 'parked') return state
  return { ...CLOSED, trips: state.trips }
}

export function onFailure(
  state: BreakerState,
  at: number,
  random: () => number = Math.random,
): BreakerState {
  if (state.phase === 'parked') return state

  const streak = state.streak + 1
  const retryAt = at + backoffFor(streak, random)

  // A probe that fails re-opens immediately rather than waiting for three
  // more: the cooldown already bought the agent its second chance.
  if (state.phase === 'half-open') {
    const trips = state.trips + 1
    return trips >= PARK_AFTER
      ? { phase: 'parked', streak, trips, openedAt: at, retryAt: null }
      : { phase: 'open', streak, trips, openedAt: at, retryAt }
  }

  if (streak >= BREAKER_THRESHOLD) {
    const trips = state.trips + 1
    return trips >= PARK_AFTER
      ? { phase: 'parked', streak, trips, openedAt: at, retryAt: null }
      : { phase: 'open', streak, trips, openedAt: at, retryAt }
  }

  return { ...state, streak, retryAt }
}

/**
 * A cancelled turn is not the agent failing.
 *
 * Three routines the person stopped by hand should not park their agent,
 * so this clears the backoff without touching the streak.
 */
export function onCancelled(state: BreakerState): BreakerState {
  return { ...state, retryAt: null }
}

/** Lets the person put a parked agent back to work. */
export function reset(): BreakerState {
  return CLOSED
}
