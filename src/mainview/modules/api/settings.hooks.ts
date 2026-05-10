import type { InferRequestType, InferResponseType } from 'hono/client'
import { useCallback } from 'react'
import { createMutation, createQuery } from 'react-query-kit'
import type { AgentId } from '../data/herbie-data.types'
import { api } from './client'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'

const $get = api.settings.$get
const $patch = api.settings.$patch

type SettingsResponse = InferResponseType<typeof $get>
type UpdateSettingsInput = InferRequestType<typeof $patch>['json']
type UpdateSettingsResponse = InferResponseType<typeof $patch>

export const useSettings = createQuery<SettingsResponse>({
  queryKey: ['settings'],
  fetcher: () => $get().then(parseResponse<SettingsResponse>),
})

export const useUpdateSettings = createMutation<
  UpdateSettingsResponse,
  UpdateSettingsInput
>({
  mutationFn: (json) =>
    $patch({ json }).then(parseResponse<UpdateSettingsResponse>),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: useSettings.getKey() })
  },
})

export function useDefaultAgent(): {
  defaultAgent: AgentId
  setDefaultAgent: (agent: AgentId) => void
} {
  const { data } = useSettings()
  const { mutate } = useUpdateSettings()
  const setDefaultAgent = useCallback(
    (agent: AgentId) => {
      mutate({ agents: { defaultAgent: agent } })
    },
    [mutate],
  )
  // No cast — if the API enum drifts from AgentId, TS catches it here.
  return {
    defaultAgent: data?.agents.defaultAgent ?? 'claude',
    setDefaultAgent,
  }
}

const RECENT_WORKSPACES_CAP = 10

// Workspaces aren't a DB entity — just paths in the settings KV. The
// composer reads the default + MRU and writes back through PATCH.
export function useWorkspaces(): {
  defaultPath: string | null
  recent: string[]
  isLoading: boolean
  addRecent: (path: string) => void
  setDefault: (path: string) => void
} {
  const { data, isLoading } = useSettings()
  const { mutate } = useUpdateSettings()
  const defaultPath = data?.composer.workspaces.default ?? null
  const recent = data?.composer.workspaces.recent ?? []

  const addRecent = useCallback(
    (path: string) => {
      // De-dupe + bump to head; cap to keep the dropdown scannable. The
      // server enforces no max — the cap is purely UX.
      const next = [path, ...recent.filter((p) => p !== path)].slice(
        0,
        RECENT_WORKSPACES_CAP,
      )
      mutate({
        composer: {
          workspaces: { default: defaultPath ?? '', recent: next },
        },
      })
    },
    [mutate, recent, defaultPath],
  )

  const setDefault = useCallback(
    (path: string) => {
      mutate({ composer: { workspaces: { default: path, recent } } })
    },
    [mutate, recent],
  )

  return { defaultPath, recent, isLoading, addRecent, setDefault }
}
