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
