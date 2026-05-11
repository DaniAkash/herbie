import type { InferResponseType } from 'hono/client'
import { createQuery } from 'react-query-kit'
import { api } from './client'
import { parseResponse } from './parseResponse'

const $get = api.agents.$get
const $caps = api.agents[':id'].capabilities.$get

export type AgentsResponse = InferResponseType<typeof $get>
export type AgentDetection = AgentsResponse[number]

type CapabilitiesResponse = Exclude<
  InferResponseType<typeof $caps>,
  { error: string }
>

export const useAgents = createQuery<AgentsResponse>({
  queryKey: ['agents'],
  fetcher: () => $get().then(parseResponse<AgentsResponse>),
  staleTime: 60_000,
})

// Capabilities are server-side cached against the agent id (server-side
// discovery is heavy: spawns a probe ACP session). staleTime: Infinity
// here just means "don't auto-refetch"; manual invalidation can force a
// re-discovery if the agent's installed model list moves.
export const useAgentCapabilities = createQuery<
  CapabilitiesResponse,
  { id: string }
>({
  queryKey: ['agents', 'capabilities'],
  fetcher: ({ id }) =>
    $caps({ param: { id } }).then(parseResponse<CapabilitiesResponse>),
  staleTime: Number.POSITIVE_INFINITY,
})
