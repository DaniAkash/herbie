// Event types for the task-run streaming pipeline. Parallel to
// chat/events.types.ts but with runId instead of conversationId — task
// runs are single-turn and persist to a separate table, so threading
// the chat types through here would muddy both. The Protocol/stream
// vocab is identical to chat's; the renderer reducer can be reused
// as-is once we feed it events of the same shape.

import type { LanguageModelUsage } from 'ai'

export type RunFinishReason =
  | 'stop'
  | 'length'
  | 'content-filter'
  | 'tool-calls'
  | 'error'
  | 'other'
  | 'unknown'

export type RunProtocolEvent =
  | {
      type: 'turn.start'
      payload: { requestId: string; userMessage: string }
    }
  | {
      type: 'turn.finish'
      payload: {
        requestId: string
        finishReason: RunFinishReason
        usage?: LanguageModelUsage
      }
    }
  | {
      type: 'turn.cancel'
      payload: { requestId: string; reason?: string }
    }
  | {
      type: 'turn.error'
      payload: {
        requestId: string
        code?: string
        message: string
        details?: string
      }
    }
  | {
      type: 'assistant.text'
      payload: { requestId: string; textId: string; text: string }
    }
  | {
      type: 'reasoning.complete'
      payload: { requestId: string; reasoningId: string; text: string }
    }

export interface PersistedRunEvent {
  runId: string
  seq: number
  type: string
  payload: unknown
  createdAt: Date
}

// Stream subtypes that flow live but never hit task_run_events —
// matches the chat side's set so the renderer's reducer can handle
// both pipelines identically. Tasks DO persist the coalesced
// terminal events (assistant.text / reasoning.complete) so a run
// can be replayed from disk later.
export const EPHEMERAL_STREAM_SUBTYPES: ReadonlySet<string> = new Set([
  'start',
  'start-step',
  'finish-step',
  'finish',
  'abort',
  'text-start',
  'text-delta',
  'text-end',
  'reasoning-start',
  'reasoning-delta',
  'reasoning-end',
  'tool-input-start',
  'tool-input-delta',
  'tool-input-end',
])

export const STREAM_SUBTYPE_RENAMES: ReadonlyMap<string, string> = new Map([
  ['tool-call', 'tool.call'],
  ['tool-result', 'tool.result'],
  ['tool-error', 'tool.error'],
])
