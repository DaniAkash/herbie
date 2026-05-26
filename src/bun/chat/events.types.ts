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
  | {
      // Emitted right after routeTurn returns the ModelMessage[] that's
      // about to be handed to streamText. Carries a character-count
      // estimate of the total input the agent will receive (rebuilt
      // transcript + the new user message). Used by the AgentBusy
      // footer to render an approximate input-token cell. Sent as a
      // separate event from turn.start so the latter can stay early
      // (before routeTurn runs) and the UI can still flip into its
      // streaming state immediately on send.
      type: 'meta.turn-input'
      payload: { requestId: string; approxInputChars: number }
    }
  | {
      // Emitted when the agent's onPermissionRequest callback fires
      // and the conversation's permission mode escalates it to the
      // user. The renderer responds via
      //   POST /chat/:id/permission/:requestId
      // which resolves the pending callback promise and emits a
      // matching permission.resolved event.
      type: 'permission.request'
      payload: {
        requestId: string
        turnRequestId: string
        toolCallId: string
        toolName: string
        toolKind: PermissionToolKind | null
        input?: unknown
      }
    }
  | {
      // Emitted after the callback's pending promise resolves — either
      // because the user clicked a button (resolvedBy='user'), the
      // current permission mode short-circuited (resolvedBy='auto'),
      // or turn.cancel landed while pending (resolvedBy='cancel').
      // Carries the final outcome so the renderer can transition the
      // card from pending to resolved without re-asking the server.
      type: 'permission.resolved'
      payload: {
        requestId: string
        outcome: PermissionOutcome
        resolvedBy: 'user' | 'auto' | 'cancel'
      }
    }

// Outcomes map 1:1 to acpx's AcpPermissionDecision. Re-declared here
// (rather than imported from acpx-ai-provider) so the renderer can
// consume this type via the existing PersistedEventDTO path without
// dragging a bun-only dep into the renderer's tsconfig.
export type PermissionOutcome =
  | 'allow_once'
  | 'allow_always'
  | 'reject_once'
  | 'reject_always'
  | 'cancel'

// Same idea — keep this union local so the renderer doesn't import
// from acpx. Mirrors the kinds acpx's inferToolKind classifier
// returns; null in the event payload covers the "could not infer"
// case.
export type PermissionToolKind =
  | 'read'
  | 'search'
  | 'fetch'
  | 'edit'
  | 'execute'
  | 'delete'
  | 'move'
  | 'switch_mode'
  | 'think'
  | 'other'

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
