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
// Narrow to the 2xx success shape — the error variant is thrown by
// parseResponse before the typed return ever materialises, so callers
// only see the row.
type CreateResponse = Extract<InferResponseType<typeof $create>, { id: string }>

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

// Detail queries for the open chat screen — useConversation in
// screens/chat/chat.hooks.ts keys these as ['chat', 'conversation', { id }].
// Renaming or otherwise mutating a conversation has to invalidate the
// detail too, otherwise the header reads a stale title until the user
// navigates away and back.
//
// Uses the prefix key (no id) so a single call refreshes every cached
// conversation. Only the on-screen chat is rendered at a time, so the
// background refetches stay cheap and the cache stays consistent for a
// fast tab-back.
function invalidateConversationDetails(): void {
  queryClient.invalidateQueries({ queryKey: ['chat', 'conversation'] })
}

export const useCreateConversation = createMutation<
  CreateResponse,
  CreateInput
>({
  mutationFn: (json) => $create({ json }).then(parseResponse<CreateResponse>),
  onSuccess: invalidateConversationLists,
  onError: toastApiError('Could not create conversation'),
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
  onSuccess: () => {
    invalidateConversationLists()
    invalidateConversationDetails()
  },
  onError: toastApiError('Could not rename conversation'),
})

export const useToggleConversationPin = createMutation<
  unknown,
  { id: string; pinned: boolean }
>({
  mutationFn: ({ id, pinned }) =>
    $patch({ param: { id }, json: { pinned } }).then(parseResponse),
  onSuccess: () => {
    invalidateConversationLists()
    invalidateConversationDetails()
  },
  onError: toastApiError('Could not update pin state'),
})

// Persists the composer's tuple (agent / model / workspace / reasoning)
// to the conversation row as the user picks. Without this, the picker's
// state lived only in React useState — navigating away and back reset
// it to whatever the row last committed (which only happened on send).
//
// Lists aren't invalidated on purpose: sidebar rows don't render tuple
// fields, so an extra refetch per picker click is wasted work. The
// detail query is invalidated so a tab-back / SSE-reconnect reads the
// fresh values from the row.
type PatchTuplePayload = InferRequestType<typeof $patch>['json']

export const useUpdateConversationTuple = createMutation<
  unknown,
  {
    id: string
    tuple: Pick<
      PatchTuplePayload,
      | 'agentId'
      | 'modelId'
      | 'workspacePath'
      | 'reasoningEffort'
      | 'permissionMode'
    >
  }
>({
  mutationFn: ({ id, tuple }) =>
    $patch({ param: { id }, json: tuple }).then(parseResponse),
  onSuccess: invalidateConversationDetails,
  onError: toastApiError('Could not save composer selection'),
})

// Posts the user's approve/deny decision back to the in-flight
// onPermissionRequest callback awaiting in permission-registry.
// No cache invalidation — the matching permission.resolved event
// lands via SSE on the chat stream and updates the renderer state
// through the same path as any other turn event.
const $permissionResolve = api.chat[':id'].permission[':requestId'].$post
export const useResolvePermission = createMutation<
  unknown,
  {
    conversationId: string
    requestId: string
    outcome: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always'
  }
>({
  mutationFn: ({ conversationId, requestId, outcome }) =>
    $permissionResolve({
      param: { id: conversationId, requestId },
      json: { outcome },
    }).then(parseResponse),
  onError: toastApiError('Could not resolve permission'),
})

export const useDeleteConversation = createMutation<unknown, { id: string }>({
  mutationFn: ({ id }) => $delete({ param: { id } }).then(parseResponse),
  onSuccess: (_data, vars) => {
    invalidateConversationLists()
    // Drop the detail cache for the deleted id so a future visit to
    // /chat/$id misses and surfaces the route's own "not found" UI
    // rather than rendering against a stale snapshot.
    queryClient.removeQueries({
      queryKey: ['chat', 'conversation', { id: vars.id }],
    })
  },
  onError: toastApiError('Could not delete conversation'),
})
