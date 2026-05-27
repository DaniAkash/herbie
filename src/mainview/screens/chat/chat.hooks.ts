import type { InferRequestType, InferResponseType } from 'hono/client'
import { useEffect, useRef } from 'react'
import { createMutation, createQuery } from 'react-query-kit'
import {
  useConversations,
  useMarkConversationSeen,
} from '@/modules/api/chat.hooks'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parseResponse'
import { queryClient } from '@/modules/api/queryClient'
import { openChatStream } from '@/modules/chat/chat-stream'
import { STORAGE_KEYS } from '@/modules/storage/keys'

const $get = api.chat[':id'].$get
const $send = api.chat[':id'].messages.$post
const $cancel = api.chat[':id'].cancel.$post

export type ConversationDetail = Exclude<
  InferResponseType<typeof $get>,
  { error: string }
>

export type SendMessageInput = { id: string } & InferRequestType<
  typeof $send
>['json']
type CancelInput = { id: string; reason?: string }

export const useConversation = createQuery<
  ConversationDetail,
  { id: string; afterSeq?: number }
>({
  queryKey: ['chat', 'conversation'],
  fetcher: ({ id, afterSeq }) =>
    $get({
      param: { id },
      query: afterSeq !== undefined ? { afterSeq: String(afterSeq) } : {},
    }).then(parseResponse<ConversationDetail>),
})

// Send/cancel don't invalidate the conversation query — events flow back
// through the SSE stream and update the cache via useChatLiveStream.
export const useSendMessage = createMutation<
  { requestId: string },
  SendMessageInput
>({
  mutationFn: ({ id, ...body }) =>
    $send({ param: { id }, json: body }).then(
      parseResponse<{ requestId: string }>,
    ),
})

export const useCancelTurn = createMutation<
  { ok: boolean; idle?: boolean },
  CancelInput
>({
  mutationFn: ({ id, reason }) =>
    $cancel({ param: { id }, json: { reason } }).then(
      parseResponse<{ ok: boolean; idle?: boolean }>,
    ),
})

function readCursor(id: string): number {
  const raw = window.localStorage.getItem(STORAGE_KEYS.chatCursor(id))
  if (!raw) return -1
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : -1
}

function writeCursor(id: string, seq: number): void {
  window.localStorage.setItem(STORAGE_KEYS.chatCursor(id), String(seq))
}

export function useChatLiveStream(conversationId: string | null): void {
  const lastSeqRef = useRef(-1)
  const markSeen = useMarkConversationSeen()
  const markSeenAsync = markSeen.mutateAsync

  useEffect(() => {
    if (!conversationId) return
    lastSeqRef.current = readCursor(conversationId)

    const handle = openChatStream(conversationId, {
      afterSeq: lastSeqRef.current,
      onEvent: (ev) => {
        if (ev.seq <= lastSeqRef.current) return
        const appended = appendEventToCache(conversationId, ev)
        // On cache miss, the conversation query hasn't loaded yet — leave
        // the cursor where it is so the refetch (triggered inside
        // appendEventToCache) catches up. Otherwise we'd advance past
        // events the cache never received.
        if (!appended) return
        lastSeqRef.current = ev.seq
        writeCursor(conversationId, ev.seq)
        // turn boundaries flip status / bump updatedAt server-side; refresh
        // the sidebar list so it re-orders when activity moves around.
        if (ev.type.startsWith('turn.')) {
          queryClient.invalidateQueries({ queryKey: useConversations.getKey() })
        }
        // Eagerly bump lastSeenAt whenever an event lands on a
        // conversation the user is actively viewing. Without this the
        // sidebar unread dot stays lit until the user navigates away
        // and back, because mark-seen only fires on Chat mount today.
        if (
          document.visibilityState === 'visible' &&
          document.hasFocus() &&
          isViewingChat(conversationId)
        ) {
          void markSeenAsync({ id: conversationId }).catch(() => undefined)
        }
      },
    })

    return () => handle.close()
  }, [conversationId, markSeenAsync])
}

function isViewingChat(conversationId: string): boolean {
  return window.location.pathname === `/chat/${conversationId}`
}

function appendEventToCache(
  conversationId: string,
  ev: { seq: number; type: string; payload: unknown; createdAt: number },
): boolean {
  const key = useConversation.getKey({ id: conversationId })
  const cached = queryClient.getQueryData<ConversationDetail>(key)
  if (!cached) {
    // The initial GET hasn't resolved yet. Don't drop the event — kick a
    // refetch and let the next round pull it from the DB.
    void queryClient.invalidateQueries({ queryKey: key })
    return false
  }
  if (cached.events.some((e: { seq: number }) => e.seq === ev.seq)) return true

  // SSE delivers events in monotonic seq order in the common case, so the
  // straight append is the hot path. Sort only if the new event landed
  // before the current tail (replay race, retry, etc).
  const last = cached.events[cached.events.length - 1]
  const events =
    !last || ev.seq > last.seq
      ? [...cached.events, ev]
      : [...cached.events, ev].sort(
          (a: { seq: number }, b: { seq: number }) => a.seq - b.seq,
        )
  queryClient.setQueryData<ConversationDetail>(key, { ...cached, events })
  return true
}
