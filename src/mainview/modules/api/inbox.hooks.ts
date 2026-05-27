import type { InferRequestType, InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from './client'
import { toastApiError } from './errorToast'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'

const $list = api.inbox.$get
const $patch = api.inbox[':id'].$patch
const $delete = api.inbox[':id'].$delete
const $open = api.inbox[':id']['open-in-chat'].$post

export type InboxListResponse = InferResponseType<typeof $list>
export type InboxItemDto = InboxListResponse[number]
type PatchInput = { id: string } & InferRequestType<typeof $patch>['json']

// Scheduled task runs create inbox rows server-side via the run
// scheduler; there is no per-mutation invalidation trigger in the
// renderer for those background writes. Poll every 5s while the
// query is observed and refetch on window focus so a freshly
// finished task appears without a manual reload. Matches the cadence
// of the tray-refresh safety-net poll on the bun side.
export const useInboxItems = createQuery<InboxListResponse>({
  queryKey: ['inbox', 'list'],
  fetcher: () => $list().then(parseResponse<InboxListResponse>),
  refetchInterval: 5000,
  refetchOnWindowFocus: true,
})

export const useUpdateInboxItem = createMutation<InboxItemDto, PatchInput>({
  mutationFn: ({ id, ...json }) =>
    $patch({ param: { id }, json }).then(parseResponse<InboxItemDto>),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: useInboxItems.getKey() })
  },
  onError: toastApiError('Failed to update inbox item'),
})

export const useDeleteInboxItem = createMutation<
  { ok: boolean },
  { id: string }
>({
  mutationFn: ({ id }) =>
    $delete({ param: { id } }).then(parseResponse<{ ok: boolean }>),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: useInboxItems.getKey() })
  },
  onError: toastApiError('Failed to delete inbox item'),
})

// "Open in chat" seeds a new conversation with the task's prompt as
// the user's first turn and the inbox body as the assistant's reply.
// The user lands mid-conversation with the full context already in
// place — no need to copy-paste the result into a new chat.
export const useOpenInChat = createMutation<
  { conversationId: string },
  { id: string }
>({
  mutationFn: ({ id }) =>
    $open({ param: { id } }).then(parseResponse<{ conversationId: string }>),
  onSuccess: () => {
    // The seeded read flip happens server-side; refresh the list.
    queryClient.invalidateQueries({ queryKey: useInboxItems.getKey() })
  },
  onError: toastApiError('Failed to open inbox item in chat'),
})
