import type { InferRequestType, InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parseResponse'
import { queryClient } from '@/modules/api/queryClient'

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

export const useSendMessage = createMutation<{ requestId: string }, SendInput>({
  mutationFn: ({ id, text }) =>
    $send({ param: { id }, json: { text } }).then(
      parseResponse<{ requestId: string }>,
    ),
  onSuccess: (_data, { id }) => {
    queryClient.invalidateQueries({
      queryKey: useConversation.getKey({ id }),
    })
  },
})

export const useCancelTurn = createMutation<
  { ok: boolean; idle?: boolean },
  CancelInput
>({
  mutationFn: ({ id, reason }) =>
    $cancel({ param: { id }, json: { reason } }).then(
      parseResponse<{ ok: boolean; idle?: boolean }>,
    ),
  onSuccess: (_data, { id }) => {
    queryClient.invalidateQueries({
      queryKey: useConversation.getKey({ id }),
    })
  },
})
