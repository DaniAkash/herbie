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
      payload: {
        requestId: string
        userMessage: string
        agentId: string
        modelId?: string | null
        workspacePath?: string | null
        reasoningEffort?: string | null
        // Persisted alongside the turn so transcript replay can render
        // attachment chips on the user bubble without re-reading bytes
        // from the chat-routes side; the metadata lookup uses these ids
        // against the attachments table.
        attachmentIds?: string[]
      }
    }
  | {
      type: 'meta.workspace-missing'
      payload: { previousPath: string; fallbackPath: string }
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
      payload: {
        requestId: string
        code?: string
        message: string
        // Optional structured detail string (e.g. JSON-RPC data.details)
        // surfaced separately so the renderer can show it under the
        // top-level message without parsing.
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
// surface; text/reasoning fragments are coalesced into a single
// terminal event (assistant.text / reasoning.complete) at end-of-block.
// Tool-input fragments are coalesced into the tool.call durable event.
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

// Stream subtypes that get renamed on the way out — same payload, but
// the namespace shifts from "stream.*" to "tool.*" so live and replay
// handlers in the renderer share a single case.
export const STREAM_SUBTYPE_RENAMES: ReadonlyMap<string, string> = new Map([
  ['tool-call', 'tool.call'],
  ['tool-result', 'tool.result'],
  ['tool-error', 'tool.error'],
])
