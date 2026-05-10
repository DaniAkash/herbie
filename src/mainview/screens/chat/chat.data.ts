import { useCallback, useMemo } from 'react'
import { emptyChatViewState, reduceChatEvents } from './chat.helpers'
import {
  type ConversationDetail,
  useCancelTurn,
  useChatLiveStream,
  useConversation,
  useSendMessage,
} from './chat.hooks'
import type { ChatMessage } from './chat.types'

export interface UseChatDataResult {
  isLoading: boolean
  conversation: ConversationDetail['conversation'] | null
  messages: ChatMessage[]
  isStreaming: boolean
  lastSeq: number
  sendMessage: (text: string) => Promise<{ requestId: string }>
  cancelTurn: (reason?: string) => Promise<unknown>
  isSending: boolean
}

export function useChatData(conversationId: string): UseChatDataResult {
  const query = useConversation({ variables: { id: conversationId } })
  const sendMutation = useSendMessage()
  const cancelMutation = useCancelTurn()
  useChatLiveStream(conversationId)

  const view = useMemo(() => {
    const events = (query.data?.events ?? []).map((e) => ({
      seq: e.seq,
      type: e.type,
      payload: e.payload,
      createdAt: e.createdAt,
    }))
    return reduceChatEvents(emptyChatViewState(), events)
  }, [query.data?.events])

  const sendMessage = useCallback(
    (text: string) => sendMutation.mutateAsync({ id: conversationId, text }),
    [conversationId, sendMutation],
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
