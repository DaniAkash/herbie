import type { InferRequestType, InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from './client'
import { toastApiError } from './errorToast'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'

const $list = api.telegram.connections.$get
const $create = api.telegram.connections.$post
const $patch = api.telegram.connections[':id'].$patch
const $delete = api.telegram.connections[':id'].$delete
const $pause = api.telegram.connections[':id'].pause.$post
const $resume = api.telegram.connections[':id'].resume.$post
const $workspaceInUse = api.telegram.connections['workspace-in-use'].$get
const $chats = api.telegram.chats.$get

export type TelegramConnection = InferResponseType<typeof $list>[number]
export type TelegramConnectionDetail = Exclude<
  InferResponseType<typeof $create>,
  { error: string }
>
export type TelegramChatsResponse = InferResponseType<typeof $chats>
export type TelegramChatsGroup = TelegramChatsResponse[number]
export type TelegramChatsEntry = TelegramChatsGroup['chats'][number]
type CreateInput = InferRequestType<typeof $create>['json']
type PatchInput = InferRequestType<typeof $patch>['json'] & { id: string }
type WorkspaceInUseResponse = InferResponseType<typeof $workspaceInUse>

export const useTelegramConnections = createQuery<TelegramConnection[]>({
  queryKey: ['telegram', 'connections'],
  fetcher: () => $list().then(parseResponse<TelegramConnection[]>),
})

// Drives the sidebar's External Chats → Telegram nest. Poll on a
// short-ish interval so new inbound chats (from Telegram) show up
// without a page reload — chat_events writes hit the API process
// directly, but the renderer doesn't get notified yet.
export const useTelegramChats = createQuery<TelegramChatsResponse>({
  queryKey: ['telegram', 'chats'],
  fetcher: () => $chats().then(parseResponse<TelegramChatsResponse>),
  refetchInterval: 4000,
})

// Callers gate this at call-time with `{ enabled: path.length > 0 }`.
// The route also no-ops on an empty path, so a misbehaving caller
// just gets `{ inUseBy: null }` rather than a 4xx.
export const useWorkspaceInUse = createQuery<
  WorkspaceInUseResponse,
  { path: string }
>({
  queryKey: ['telegram', 'workspace-in-use'],
  fetcher: ({ path }) =>
    $workspaceInUse({ query: { path } }).then(
      parseResponse<WorkspaceInUseResponse>,
    ),
})

export const useCreateTelegramConnection = createMutation<
  TelegramConnectionDetail,
  CreateInput
>({
  mutationFn: (json) =>
    $create({ json }).then(parseResponse<TelegramConnectionDetail>),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: useTelegramConnections.getKey(),
    })
  },
  onError: toastApiError('Failed to add Telegram connection'),
})

export const useUpdateTelegramConnection = createMutation<
  TelegramConnectionDetail,
  PatchInput
>({
  mutationFn: ({ id, ...json }) =>
    $patch({ param: { id }, json }).then(
      parseResponse<TelegramConnectionDetail>,
    ),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: useTelegramConnections.getKey(),
    })
  },
  onError: toastApiError('Failed to update Telegram connection'),
})

export const useDeleteTelegramConnection = createMutation<
  { ok: boolean },
  { id: string }
>({
  mutationFn: ({ id }) =>
    $delete({ param: { id } }).then(parseResponse<{ ok: boolean }>),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: useTelegramConnections.getKey(),
    })
  },
  onError: toastApiError('Failed to delete Telegram connection'),
})

export const usePauseTelegramConnection = createMutation<
  TelegramConnectionDetail,
  { id: string }
>({
  mutationFn: ({ id }) =>
    $pause({ param: { id } }).then(parseResponse<TelegramConnectionDetail>),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: useTelegramConnections.getKey(),
    })
  },
  onError: toastApiError('Failed to pause Telegram bot'),
})

export const useResumeTelegramConnection = createMutation<
  TelegramConnectionDetail,
  { id: string }
>({
  mutationFn: ({ id }) =>
    $resume({ param: { id } }).then(parseResponse<TelegramConnectionDetail>),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: useTelegramConnections.getKey(),
    })
  },
  onError: toastApiError('Failed to resume Telegram bot'),
})
