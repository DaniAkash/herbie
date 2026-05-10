import type { InferRequestType, InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from './client'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'

const $list = api.chat.$get
const $create = api.chat.$post

export type ConversationsResponse = InferResponseType<typeof $list>
export type ConversationSummary = ConversationsResponse[number]

type CreateInput = InferRequestType<typeof $create>['json']
type CreateResponse = InferResponseType<typeof $create>

export const useConversations = createQuery<ConversationsResponse>({
  queryKey: ['chat', 'list'],
  fetcher: () => $list().then(parseResponse<ConversationsResponse>),
})

export const useCreateConversation = createMutation<
  CreateResponse,
  CreateInput
>({
  mutationFn: (json) => $create({ json }).then(parseResponse<CreateResponse>),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: useConversations.getKey() })
  },
})
