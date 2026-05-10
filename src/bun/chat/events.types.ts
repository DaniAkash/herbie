import type { LanguageModelUsage } from 'ai'

export type TurnFinishReason =
  | 'stop'
  | 'length'
  | 'content-filter'
  | 'tool-calls'
  | 'error'
  | 'other'
  | 'unknown'

export type ProtocolEvent =
  | {
      type: 'turn.start'
      payload: { requestId: string; userMessage: string }
    }
  | {
      type: 'turn.finish'
      payload: {
        requestId: string
        finishReason: TurnFinishReason
        usage?: LanguageModelUsage
      }
    }
  | {
      type: 'turn.cancel'
      payload: { requestId: string; reason?: string }
    }
  | {
      type: 'turn.error'
      payload: { requestId: string; code?: string; message: string }
    }
  | {
      type: 'meta.title'
      payload: { title: string }
    }

export interface PersistedEvent {
  conversationId: string
  seq: number
  type: string
  payload: unknown
  createdAt: Date
}

// Stream subtypes the rich reducer explicitly no-ops as "framing events
// with no UI surface" (see chat.reducer.ts). They consume seqs on the bus
// for live ordering but never hit chat_events.
export const EPHEMERAL_STREAM_SUBTYPES: ReadonlySet<string> = new Set([
  'start',
  'start-step',
  'finish-step',
  'finish',
  'abort',
])
