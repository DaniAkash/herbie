export type ChatRole = 'user' | 'assistant'

export type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

export interface TextPart {
  kind: 'text'
  id: string
  text: string
  isOpen: boolean
}

export interface ReasoningPart {
  kind: 'reasoning'
  id: string
  text: string
  isOpen: boolean
  isPlan: boolean
}

export interface ToolPart {
  kind: 'tool'
  id: string
  toolCallId: string
  toolName: string
  input: string
  output: string | null
  isError: boolean
  errorMessage?: string
  // True only while a live stream.tool-input-* sequence is still
  // waiting for the terminal tool.call to bind it to a real
  // toolCallId. False on direct-path (replay / providers that emit
  // tool.call without the input-streaming prelude — codex et al).
  // bindToolCallId only rebinds parts whose isPlaceholder is true,
  // which keeps sequential tool.call events from rebinding already-
  // resolved parts when no streaming prelude opened a placeholder.
  isPlaceholder: boolean
  state: ToolPartState
}

export type PermissionOutcome =
  | 'allow_once'
  | 'allow_always'
  | 'reject_once'
  | 'reject_always'
  | 'cancel'

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

// Inline approval card. State starts at 'pending' when permission.request
// arrives and transitions to 'resolved' when permission.resolved lands.
// resolvedBy='auto' means the conversation's mode (e.g. allow-all)
// auto-decided — the renderer collapses these into a compact breadcrumb
// rather than the full card.
export interface PermissionPart {
  kind: 'permission'
  id: string // = requestId
  turnRequestId: string
  toolCallId: string
  toolName: string
  toolKind: PermissionToolKind | null
  input?: unknown
  state: 'pending' | 'resolved'
  outcome?: PermissionOutcome
  resolvedBy?: 'user' | 'auto' | 'cancel'
  resolvedAt?: number
}

export type MessagePart = TextPart | ReasoningPart | ToolPart | PermissionPart

export interface ChatMessage {
  id: string
  role: ChatRole
  parts: MessagePart[]
  agent?: string
  fromTaskId?: string
  // Attachment ids the user posted with this message; the renderer
  // fetches metadata + the blob via /attachments/:id and
  // /attachments/:id/blob. Empty / undefined on every assistant
  // message and on user turns sent without uploads.
  attachmentIds?: string[]
  createdAt: number
  isStreaming: boolean
  isCancelled: boolean
  isError: boolean
  errorMessage?: string
  // Structured detail from JSON-RPC-style errors (e.g. acpx's
  // data.details). Renderer shows it as a stack-style block under the
  // primary message.
  errorDetails?: string
  errorCode?: string
}

// Snapshot of the currently-streaming assistant message used by the
// AgentBusy footer. Lives outside ChatMessage so the field set stays
// scoped to the indicator and never pollutes message rendering.
// Undefined whenever no turn is in flight.
export interface ActiveAssistant {
  // ms epoch from the turn.start event — anchors the elapsed-time tick.
  startedAt: number
  // Running sum of all text/reasoning delta lengths in this turn.
  // Append-only; reset on turn.start (new active message), cleared on
  // finalize.
  liveOutputChars: number
  // Best-effort character count of the input the agent received
  // (rebuilt transcript + new user message). Populated by a
  // meta.turn-input event emitted right after routeTurn returns, so
  // it lands a moment after turn.start — undefined until then.
  approxInputChars?: number
}

export interface ChatViewState {
  messages: ChatMessage[]
  isStreaming: boolean
  lastSeq: number
  activeAssistant?: ActiveAssistant
}

export interface PersistedEventDTO {
  seq: number
  type: string
  payload: unknown
  createdAt: number
}
