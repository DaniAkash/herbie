import type { InferResponseType } from 'hono/client'
import { createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'

export type StatusResponse = InferResponseType<Client['api']['status']['$get']>

type Client = Awaited<ReturnType<typeof api>>

export const useStatus = createQuery<StatusResponse>({
  queryKey: ['status'],
  fetcher: async () => {
    const client = await api()
    return parseResponse<StatusResponse>(await client.api.status.$get())
  },
  refetchInterval: 2000,
})
