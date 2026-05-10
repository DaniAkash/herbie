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
      type: 'assistant.text'
      payload: { requestId: string; textId: string; text: string }
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

// Stream subtypes that flow on the bus (live UI consumes them via the
// rich reducer) but never hit chat_events. Framing events have no UI
// surface; text-{start,delta,end} are coalesced into a single
// `assistant.text` durable event written at text-end.
export const EPHEMERAL_STREAM_SUBTYPES: ReadonlySet<string> = new Set([
  'start',
  'start-step',
  'finish-step',
  'finish',
  'abort',
  'text-start',
  'text-delta',
  'text-end',
])
