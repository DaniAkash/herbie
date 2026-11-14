import type {
  AttentionState,
  NotifyEvent,
} from '@bun/modules/notifications/events'
import type { TranscriptRecord } from '@bun/shared/transcript'

/**
 * What a record says about the agent that wrote it.
 *
 * The two moments that matter most are not turn ends at all: a permission
 * prompt and an `ask` both hold mid turn and never write `turn.end`, so a
 * reading keyed on turn completion misses exactly the cases where the agent
 * is most literally frozen.
 */

/** Set when the record carried the agent's own words, for the body. */
function wordsOf(record: TranscriptRecord): string | null {
  if (record.kind === 'say' || record.kind === 'explain') return record.text
  if (record.kind === 'permission') return record.detail || record.toolName
  if (record.kind === 'ask') return record.questions[0]?.q ?? null
  if (record.kind === 'error') return record.text
  return null
}

/**
 * A turn's duration, when the pair that bounds it is known.
 *
 * Measured from the start record rather than from when this module first saw
 * the agent, so a sidecar that restarted mid turn does not report a turn as
 * having run for the few seconds it has been watching.
 */
export interface TurnClock {
  readonly turnId: string
  readonly startedAt: number
}

export interface Reading {
  readonly becomes: AttentionState
  readonly event: NotifyEvent | null
}

/**
 * Reads one record as a state, and as news or not.
 *
 * A reading can move the state without being worth saying: `working` is the
 * common case, and a cancel returns the agent to idle because the person
 * stopping work is never news.
 */
export function read(
  record: TranscriptRecord,
  agentId: string,
  clock: TurnClock | null,
  at: number,
): Reading {
  const text = wordsOf(record)

  if (record.kind === 'permission' && record.decision === null) {
    return {
      becomes: 'awaiting',
      event: {
        agentId,
        turnId: record.turn,
        becomes: 'awaiting',
        text,
        kind: 'needs_you',
        reason: 'permission',
      },
    }
  }

  if (record.kind === 'ask' && record.answers === null) {
    return {
      becomes: 'awaiting',
      event: {
        agentId,
        turnId: record.turn,
        becomes: 'awaiting',
        text,
        kind: 'needs_you',
        reason: 'question',
      },
    }
  }

  // Answering either hold puts the agent back to work, and that transition is
  // what withdraws a live banner: the person has already responded.
  if (record.kind === 'decision' || record.kind === 'answer') {
    return { becomes: 'working', event: null }
  }

  if (record.kind === 'turn.start') return { becomes: 'working', event: null }

  if (record.kind === 'turn.end') {
    if (record.reason === 'cancel') return { becomes: 'idle', event: null }
    if (record.reason === 'error') {
      return {
        becomes: 'failed',
        event: {
          agentId,
          turnId: record.turn,
          becomes: 'failed',
          text,
          kind: 'turn_failed',
        },
      }
    }
    const ranForMs =
      clock && clock.turnId === record.turn ? at - clock.startedAt : 0
    return {
      becomes: 'done',
      event: {
        agentId,
        turnId: record.turn,
        becomes: 'done',
        text,
        kind: 'turn_done',
        ranForMs,
      },
    }
  }

  return { becomes: 'working', event: null }
}

/** The breaker giving up, which reaches no bus and has to be handed in. */
export function parkEvent(agentId: string): NotifyEvent {
  return {
    agentId,
    turnId: null,
    becomes: 'failed',
    text: null,
    kind: 'agent_parked',
  }
}
