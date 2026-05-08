import type { InferRequestType, InferResponseType } from 'hono/client'
import { useCallback } from 'react'
import { createMutation, createQuery } from 'react-query-kit'
import type { AgentId } from '../data/herbie-data.types'
import { api } from './client'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'

const $get = api['app-settings'].$get
const $patch = api['app-settings'].$patch

type AppSettingsResponse = InferResponseType<typeof $get>
type UpdateAppSettingsInput = InferRequestType<typeof $patch>['json']
type UpdateAppSettingsResponse = InferResponseType<typeof $patch>

export const useAppSettings = createQuery<AppSettingsResponse>({
  queryKey: ['app-settings'],
  fetcher: () => $get().then(parseResponse<AppSettingsResponse>),
})

export const useUpdateAppSettings = createMutation<
  UpdateAppSettingsResponse,
  UpdateAppSettingsInput
>({
  mutationFn: (json) =>
    $patch({ json }).then(parseResponse<UpdateAppSettingsResponse>),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: useAppSettings.getKey() })
  },
})

export function useDefaultAgent(): {
  defaultAgent: AgentId
  setDefaultAgent: (agent: AgentId) => void
} {
  const { data } = useAppSettings()
  const { mutate } = useUpdateAppSettings()
  const setDefaultAgent = useCallback(
    (agent: AgentId) => {
      mutate({ defaultAgent: agent })
    },
    [mutate],
  )
  return {
    defaultAgent: (data?.defaultAgent ?? 'claude') as AgentId,
    setDefaultAgent,
  }
}
