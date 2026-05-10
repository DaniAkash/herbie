import type { InferRequestType, InferResponseType } from 'hono/client'
import { useEffect, useRef } from 'react'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parseResponse'
import { queryClient } from '@/modules/api/queryClient'
import { openChatStream } from '@/modules/chat/chat-stream'

const $create = api.chat.$post
const $get = api.chat[':id'].$get
const $send = api.chat[':id'].messages.$post
const $cancel = api.chat[':id'].cancel.$post

export type ConversationDetail = Exclude<
  InferResponseType<typeof $get>,
  { error: string }
>

type CreateInput = InferRequestType<typeof $create>['json']
type CreateResponse = InferResponseType<typeof $create>
type SendInput = { id: string; text: string }
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

export const useCreateConversation = createMutation<
  CreateResponse,
  CreateInput
>({
  mutationFn: (json) => $create({ json }).then(parseResponse<CreateResponse>),
})

// Send/cancel don't invalidate the conversation query — events flow back
// through the SSE stream and update the cache via useChatLiveStream.
export const useSendMessage = createMutation<{ requestId: string }, SendInput>({
  mutationFn: ({ id, text }) =>
    $send({ param: { id }, json: { text } }).then(
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

const cursorKey = (id: string) => `herbie.chat.${id}.lastSeq`

function readCursor(id: string): number {
  const raw = window.localStorage.getItem(cursorKey(id))
  if (!raw) return -1
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : -1
}

function writeCursor(id: string, seq: number): void {
  window.localStorage.setItem(cursorKey(id), String(seq))
}

export function useChatLiveStream(conversationId: string | null): void {
  const lastSeqRef = useRef(-1)

  useEffect(() => {
    if (!conversationId) return
    lastSeqRef.current = readCursor(conversationId)

    const handle = openChatStream(conversationId, {
      afterSeq: lastSeqRef.current,
      onEvent: (ev) => {
        if (ev.seq <= lastSeqRef.current) return
        lastSeqRef.current = ev.seq
        writeCursor(conversationId, ev.seq)
        appendEventToCache(conversationId, ev)
      },
    })

    return () => handle.close()
  }, [conversationId])
}

function appendEventToCache(
  conversationId: string,
  ev: { seq: number; type: string; payload: unknown; createdAt: number },
): void {
  queryClient.setQueryData<ConversationDetail>(
    useConversation.getKey({ id: conversationId }),
    (old) => {
      if (!old) return old
      if (old.events.some((e) => e.seq === ev.seq)) return old
      return {
        ...old,
        events: [...old.events, ev].sort((a, b) => a.seq - b.seq),
      }
    },
  )
}
