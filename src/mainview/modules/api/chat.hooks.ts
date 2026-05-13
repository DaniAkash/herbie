import type { InferRequestType, InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from './client'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'

const $list = api.chat.$get
const $create = api.chat.$post
const $seen = api.chat[':id'].seen.$post

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

// Fires when a conversation opens — clears its unread badge in the
// sidebar by bumping lastSeenAt server-side. Failures are silent;
// the next badge fetch will reflect server state regardless.
export const useMarkConversationSeen = createMutation<
  { ok: boolean },
  { id: string }
>({
  mutationFn: ({ id }) =>
    $seen({ param: { id } }).then(parseResponse<{ ok: boolean }>),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['telegram', 'chats'] })
  },
})
