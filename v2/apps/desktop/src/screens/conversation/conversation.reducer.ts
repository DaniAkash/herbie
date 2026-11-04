import type { LiveTurn, TranscriptRecord } from '@bun/shared/transcript'

/**
 * One switch over the record stream, for both replay and live.
 *
 * The single-switch discipline is lifted from v1. Its loud default is louder
 * here: v1 warned at runtime, and this refuses to compile. A record kind
 * nobody handled is a block the person cannot see, and the sidecar and the
 * webview ship from one commit, so there is no version skew that could
 * deliver a kind this build has never heard of.
 *
 * Each dispatch applies one record to the previous state, so a long turn
 * costs one fold per block rather than re-reducing the whole thread per
 * block, which was the other thing v1 got right late.
 */

export type Phase = 'idle' | 'thinking' | 'working' | 'waiting'

export interface ThreadState {
  /** What the thread renders, in order, lifecycle records already dropped. */
  readonly records: readonly TranscriptRecord[]
  /** Answers, by the id of the `ask` record they belong to. */
  readonly answers: Readonly<Record<string, Record<string, readonly number[]>>>
  /** Decisions, by the id of the `permission` record they settle. */
  readonly decisions: Readonly<Record<string, string | null>>
  /** Blocks still waiting on the person, newest last. */
  readonly pending: readonly string[]
  readonly lastSeq: number
  readonly phase: Phase
  readonly activity: string
  /** When the turn in flight began, for the indicator's elapsed clock. */
  readonly startedAt: number | null
  readonly error: string | null
}

export const EMPTY: ThreadState = {
  records: [],
  answers: {},
  decisions: {},
  pending: [],
  lastSeq: -1,
  phase: 'idle',
  activity: '',
  startedAt: null,
  error: null,
}

export type ThreadAction =
  | { type: 'record'; record: TranscriptRecord }
  | { type: 'turn'; live: LiveTurn | null }
  | { type: 'reset' }

export function threadReducer(
  state: ThreadState,
  action: ThreadAction,
): ThreadState {
  switch (action.type) {
    case 'reset':
      return EMPTY

    case 'turn':
      return applyLive(state, action.live)

    case 'record':
      // The stream replays from a cursor and then goes live, and the two can
      // overlap by a record on a reconnect. Sequence numbers are the dedupe.
      if (action.record.seq <= state.lastSeq) return state
      return { ...apply(state, action.record), lastSeq: action.record.seq }

    default:
      return exhausted(action, state)
  }
}

/**
 * The live turn, from whatever the server last said about it.
 *
 * Applied separately from the records because a reconnect past the
 * `turn.start` record would otherwise have no way to learn a turn is running.
 */
function applyLive(state: ThreadState, live: LiveTurn | null): ThreadState {
  if (!live) {
    return state.phase === 'waiting'
      ? state
      : { ...state, phase: 'idle', startedAt: null }
  }
  return {
    ...state,
    phase: state.pending.length > 0 ? 'waiting' : live.phase,
    activity: live.activity,
    startedAt: live.startedAt,
  }
}

/** Nothing is waiting any more once this id is settled. */
function settled(pending: readonly string[], id: string): string[] {
  return pending.filter((entry) => entry !== id)
}

function apply(state: ThreadState, record: TranscriptRecord): ThreadState {
  switch (record.kind) {
    // The lifecycle. None of these is a block; they move the indicator.
    case 'turn.start':
      return {
        ...state,
        phase: 'thinking',
        startedAt: Date.parse(record.at),
        error: null,
      }

    case 'turn.end':
      return {
        ...state,
        phase: 'idle',
        startedAt: null,
        activity: '',
      }

    case 'activity':
      return {
        ...state,
        phase: state.pending.length > 0 ? 'waiting' : record.phase,
        activity: record.text,
      }

    // The two records that fold onto an earlier one rather than rendering.
    // The thread is append-only, so an answered question is a second line
    // naming the first rather than an edit of it.
    case 'answer': {
      const pending = settled(state.pending, record.ref)
      return {
        ...state,
        answers: { ...state.answers, [record.ref]: record.answers },
        pending,
        phase:
          pending.length === 0 && state.startedAt ? 'working' : state.phase,
      }
    }

    case 'decision': {
      const pending = settled(state.pending, record.ref)
      return {
        ...state,
        decisions: { ...state.decisions, [record.ref]: record.optionId },
        pending,
        phase:
          pending.length === 0 && state.startedAt ? 'working' : state.phase,
      }
    }

    // The blocks that block.
    case 'ask':
    case 'permission':
      return {
        ...state,
        records: [...state.records, record],
        pending: [...state.pending, record.id],
        phase: 'waiting',
      }

    case 'error':
      return {
        ...state,
        records: [...state.records, record],
        error: record.text,
      }

    // Everything the person simply reads.
    case 'user':
    case 'say':
    case 'explain':
    case 'show_work':
    case 'show_tasks':
    case 'show_code':
    case 'recommend':
    case 'show_context':
    case 'show_insight':
      return { ...state, records: [...state.records, record] }

    default:
      return exhausted(record, state)
  }
}

/**
 * The branch a complete switch can never reach.
 *
 * Typing the argument as `never` is what makes an unhandled record kind a
 * build failure rather than a block that quietly does not render.
 */
function exhausted(_unreachable: never, state: ThreadState): ThreadState {
  return state
}

/** Whether the person is being waited on by this block, right now. */
export function isWaiting(state: ThreadState, recordId: string): boolean {
  return state.pending.includes(recordId)
}
