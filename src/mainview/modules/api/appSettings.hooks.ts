import type { InferRequestType, InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
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
