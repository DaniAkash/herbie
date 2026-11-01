import type { Client } from '@bun/server/client'
import type { InferResponseType } from 'hono/client'
import { createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'

export type AgentsResponse = InferResponseType<Client['api']['agents']['$get']>
export type Agent = AgentsResponse['agents'][number]
export type MessagesResponse = InferResponseType<
  Client['api']['agents'][':id']['messages']['$get']
>
export type Message = MessagesResponse['messages'][number]
export type RoutinesResponse = InferResponseType<
  Client['api']['agents'][':id']['routines']['$get']
>
export type Routine = RoutinesResponse['routines'][number]

/** Every agent, for the rail. Loaded once by the shell and read everywhere. */
export const useAgents = createQuery<AgentsResponse>({
  queryKey: ['agents'],
  fetcher: async () => {
    const client = await api()
    return parseResponse<AgentsResponse>(await client.api.agents.$get())
  },
})

export const useMessages = createQuery<MessagesResponse, { agentId: string }>({
  queryKey: ['agent-messages'],
  fetcher: async ({ agentId }) => {
    const client = await api()
    return parseResponse<MessagesResponse>(
      await client.api.agents[':id'].messages.$get({ param: { id: agentId } }),
    )
  },
})

export const useRoutines = createQuery<RoutinesResponse, { agentId: string }>({
  queryKey: ['agent-routines'],
  fetcher: async ({ agentId }) => {
    const client = await api()
    return parseResponse<RoutinesResponse>(
      await client.api.agents[':id'].routines.$get({ param: { id: agentId } }),
    )
  },
})
