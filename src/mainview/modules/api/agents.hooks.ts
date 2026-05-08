import type { InferResponseType } from 'hono/client'
import { createQuery } from 'react-query-kit'
import { api } from './client'
import { parseResponse } from './parseResponse'

const $get = api.agents.$get

export type AgentsResponse = InferResponseType<typeof $get>
export type AgentDetection = AgentsResponse[number]

export const useAgents = createQuery<AgentsResponse>({
  queryKey: ['agents'],
  fetcher: () => $get().then(parseResponse<AgentsResponse>),
  // Detection probes hit FS + spawn child processes. Cache aggressively
  // and let React Query re-fetch on window focus.
  staleTime: 60_000,
})
