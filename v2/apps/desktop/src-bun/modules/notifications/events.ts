/**
 * What an agent can be, and what is worth saying about it.
 *
 * The vocabulary is deliberately about the agent rather than about the
 * transcript: a person wants to know that something is blocked, not which
 * record carried the news.
 */

/**
 * Five states, derived in the sidecar and held in memory.
 *
 * Not a column on `agents`, because the hot path already writes enough per
 * record and nothing outside this module needs it durable.
 */
export type AttentionState = 'idle' | 'working' | 'awaiting' | 'done' | 'failed'

export type NotifyKind =
  | 'needs_you'
  | 'turn_failed'
  | 'agent_parked'
  | 'turn_done'
  | 'routine_done'

/** Which flavour of `needs_you`, since the person's response is the same either way. */
export type NeedsYouReason = 'permission' | 'question'

/**
 * One thing that happened, with everything a decision needs to judge it.
 *
 * `becomes` is the state this event moves the agent into, which is what makes
 * the transition rule checkable without the decision reaching for history.
 */
export type NotifyEvent = {
  readonly agentId: string
  readonly turnId: string | null
  readonly becomes: AttentionState
  /** The agent's own words, when the record that triggered this carried any. */
  readonly text: string | null
} & (
  | { readonly kind: 'needs_you'; readonly reason: NeedsYouReason }
  | { readonly kind: 'turn_failed' }
  | { readonly kind: 'agent_parked' }
  | { readonly kind: 'turn_done'; readonly ranForMs: number }
  | { readonly kind: 'routine_done'; readonly routineId: string }
)

/**
 * Which kinds the person has switched on, and the one threshold.
 *
 * Read from the settings table as data, so a new routing rule is a row
 * rather than a branch.
 */
export interface NotifyPrefs {
  readonly enabled: boolean
  readonly needsYou: boolean
  readonly turnFailed: boolean
  readonly agentParked: boolean
  readonly turnDone: boolean
  readonly routineDone: boolean
  readonly doneAfterSeconds: number
}

/** Whether the person is at the window, and what they are looking at. */
export interface Presence {
  readonly focused: boolean
  readonly agentId: string | null
  readonly at: number
}
