import type { InferRequestType, InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from './client'
import { toastApiError } from './errorToast'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'

const $list = api.chat.$get
const $create = api.chat.$post
const $seen = api.chat[':id'].seen.$post
const $patch = api.chat[':id'].$patch
const $delete = api.chat[':id'].$delete

export type ConversationsResponse = InferResponseType<typeof $list>
export type ConversationSummary = ConversationsResponse[number]

type CreateInput = InferRequestType<typeof $create>['json']
type CreateResponse = InferResponseType<typeof $create>

export const useConversations = createQuery<ConversationsResponse>({
  queryKey: ['chat', 'list'],
  fetcher: () => $list().then(parseResponse<ConversationsResponse>),
})

function invalidateConversationLists(): void {
  queryClient.invalidateQueries({ queryKey: useConversations.getKey() })
  // Telegram sidebar reads its own list; keep them in sync since both
  // panels may surface unread badges that came from the same DB write.
  queryClient.invalidateQueries({ queryKey: ['telegram', 'chats'] })
}

export const useCreateConversation = createMutation<
  CreateResponse,
  CreateInput
>({
  mutationFn: (json) => $create({ json }).then(parseResponse<CreateResponse>),
  onSuccess: invalidateConversationLists,
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
  onSuccess: invalidateConversationLists,
})

export const useRenameConversation = createMutation<
  unknown,
  { id: string; title: string }
>({
  mutationFn: ({ id, title }) =>
    $patch({ param: { id }, json: { title } }).then(parseResponse),
  onSuccess: invalidateConversationLists,
  onError: toastApiError('Could not rename conversation'),
})

export const useToggleConversationPin = createMutation<
  unknown,
  { id: string; pinned: boolean }
>({
  mutationFn: ({ id, pinned }) =>
    $patch({ param: { id }, json: { pinned } }).then(parseResponse),
  onSuccess: invalidateConversationLists,
  onError: toastApiError('Could not update pin state'),
})

export const useDeleteConversation = createMutation<unknown, { id: string }>({
  mutationFn: ({ id }) => $delete({ param: { id } }).then(parseResponse),
  onSuccess: invalidateConversationLists,
  onError: toastApiError('Could not delete conversation'),
})
