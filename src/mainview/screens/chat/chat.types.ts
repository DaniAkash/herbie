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
  state: ToolPartState
}

export type MessagePart = TextPart | ReasoningPart | ToolPart

export interface ChatMessage {
  id: string
  role: ChatRole
  parts: MessagePart[]
  agent?: string
  fromTaskId?: string
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

export interface ChatViewState {
  messages: ChatMessage[]
  isStreaming: boolean
  lastSeq: number
}

export interface PersistedEventDTO {
  seq: number
  type: string
  payload: unknown
  createdAt: number
}
