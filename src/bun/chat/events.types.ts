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
