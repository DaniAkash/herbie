import type {
  NotifyEvent,
  NotifyKind,
  NotifyPrefs,
  Presence,
} from '@bun/modules/notifications/events'

/**
 * Whether to interrupt the person, and if not, why not.
 *
 * Pure on purpose: everything arrives as an argument and nothing reads a
 * clock or a row, which is what lets the whole fire matrix be a table rather
 * than a harness.
 */

export type ChannelId = 'inbox' | 'desktop' | 'telegram'

export type SuppressReason =
  | 'kind_disabled'
  | 'all_disabled'
  | 'already_seen'
  | 'not_a_transition'
  | 'too_short_to_miss'
  | 'no_longer_true'

export interface Fired {
  readonly fire: true
  readonly channels: ChannelId[]
  readonly collapseKey: string
}

export interface Suppressed {
  readonly fire: false
  readonly because: SuppressReason
}

export type Decision = Fired | Suppressed

/**
 * The two suppressions that still leave a row behind.
 *
 * The inbox is the record of what happened, so an event the person simply
 * did not need interrupting about is still worth listing. The other
 * suppressions are different in kind: a non transition was never news, a
 * stale event is no longer true, and a kind switched off is the person
 * saying they do not want it at all.
 */
const STILL_WORTH_RECORDING: ReadonlySet<SuppressReason> = new Set([
  'already_seen',
  'too_short_to_miss',
])

export function recordsAnyway(because: SuppressReason): boolean {
  return STILL_WORTH_RECORDING.has(because)
}

function wanted(kind: NotifyKind, prefs: NotifyPrefs): boolean {
  switch (kind) {
    case 'needs_you':
      return prefs.needsYou
    case 'turn_failed':
      return prefs.turnFailed
    case 'agent_parked':
      return prefs.agentParked
    case 'turn_done':
      return prefs.turnDone
    case 'routine_done':
      return prefs.routineDone
  }
}

/**
 * Whether the person can already see this.
 *
 * Two conjuncts and no more. agent-terminal ran a third, whether the thread
 * itself held focus, and it did not survive into what they shipped: being on
 * the thread is enough. A banner nobody strictly needed costs far less than
 * an agent that sat blocked for twenty minutes.
 */
function watching(event: NotifyEvent, presence: Presence): boolean {
  return presence.focused && presence.agentId === event.agentId
}

export function decide(
  event: NotifyEvent,
  presence: Presence,
  previous: NotifyEvent['becomes'],
  prefs: NotifyPrefs,
): Decision {
  // Fire on transitions into a state, never within one. This is what makes a
  // debounce unnecessary: a burst of tool calls stays inside `working` and
  // never reaches a decision at all.
  if (event.becomes === previous) {
    return { fire: false, because: 'not_a_transition' }
  }
  if (!prefs.enabled) return { fire: false, because: 'all_disabled' }
  if (!wanted(event.kind, prefs)) {
    return { fire: false, because: 'kind_disabled' }
  }

  // The only conditional kind, and the rule comes from using the product. A
  // five second turn you sat through is not news; without the floor this
  // fires on every reply and the person switches the whole feature off.
  if (
    event.kind === 'turn_done' &&
    event.ranForMs < prefs.doneAfterSeconds * 1000
  ) {
    return { fire: false, because: 'too_short_to_miss' }
  }

  if (watching(event, presence)) {
    return { fire: false, because: 'already_seen' }
  }

  return {
    fire: true,
    channels: ['inbox', 'desktop'],
    collapseKey: event.agentId,
  }
}
