export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  agent?: string
  fromTaskId?: string
  createdAt: number
  isStreaming: boolean
  isCancelled: boolean
  isError: boolean
  errorMessage?: string
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
