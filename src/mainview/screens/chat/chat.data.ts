import { useCallback, useMemo, useRef } from 'react'
import { emptyChatViewState, reduceChatEvents } from './chat.helpers'
import {
  type ConversationDetail,
  type SendMessageInput,
  useCancelTurn,
  useChatLiveStream,
  useConversation,
  useSendMessage,
} from './chat.hooks'
import type {
  ChatMessage,
  ChatViewState,
  PersistedEventDTO,
} from './chat.types'

export interface UseChatDataResult {
  isLoading: boolean
  conversation: ConversationDetail['conversation'] | null
  messages: ChatMessage[]
  isStreaming: boolean
  lastSeq: number
  sendMessage: (input: SendMessageInput) => Promise<{ requestId: string }>
  cancelTurn: (reason?: string) => Promise<unknown>
  isSending: boolean
}

export function useChatData(conversationId: string): UseChatDataResult {
  const query = useConversation({ variables: { id: conversationId } })
  const sendMutation = useSendMessage()
  const cancelMutation = useCancelTurn()
  useChatLiveStream(conversationId)

  // Maintain the reduced view across renders so each new event applies
  // incrementally — re-reducing the full event log per text-delta would be
  // O(n²) over the course of a turn.
  const stateRef = useRef<{ id: string; state: ChatViewState }>({
    id: conversationId,
    state: emptyChatViewState(),
  })

  const view = useMemo(() => {
    const events = (query.data?.events ?? []) as PersistedEventDTO[]
    const prior =
      stateRef.current.id === conversationId
        ? stateRef.current.state
        : emptyChatViewState()
    const next = reduceChatEvents(prior, events)
    stateRef.current = { id: conversationId, state: next }
    return next
  }, [conversationId, query.data?.events])

  const sendMessage = useCallback(
    (input: SendMessageInput) => sendMutation.mutateAsync(input),
    [sendMutation],
  )

  const cancelTurn = useCallback(
    (reason?: string) =>
      cancelMutation.mutateAsync({ id: conversationId, reason }),
    [conversationId, cancelMutation],
  )

  return {
    isLoading: query.isLoading,
    conversation: query.data?.conversation ?? null,
    messages: view.messages,
    isStreaming: view.isStreaming,
    lastSeq: view.lastSeq,
    sendMessage,
    cancelTurn,
    isSending: sendMutation.isPending,
  }
}
