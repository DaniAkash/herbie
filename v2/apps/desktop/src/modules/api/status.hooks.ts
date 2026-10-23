import type { InferResponseType } from 'hono/client'
import { createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'

type StatusResponse = InferResponseType<Client['api']['status']['$get']>
type AgentsResponse = InferResponseType<Client['api']['agents']['$get']>

type Client = Awaited<ReturnType<typeof api>>

export const useStatus = createQuery<StatusResponse>({
  queryKey: ['status'],
  fetcher: async () => {
    const client = await api()
    return parseResponse<StatusResponse>(await client.api.status.$get())
  },
  refetchInterval: 2000,
})

export const useAgents = createQuery<AgentsResponse>({
  queryKey: ['agents'],
  fetcher: async () => {
    const client = await api()
    return parseResponse<AgentsResponse>(await client.api.agents.$get())
  },
})
