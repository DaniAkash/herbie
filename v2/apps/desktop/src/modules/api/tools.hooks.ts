import type { InferResponseType } from 'hono/client'
import { createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'

type Client = Awaited<ReturnType<typeof api>>

export type ToolsResponse = InferResponseType<Client['api']['tools']['$get']>
export type McpServer = ToolsResponse['servers'][number]
export type Skill = ToolsResponse['skills'][number]
export type AccessResponse = InferResponseType<
  Client['api']['tools']['access'][':agentId']['$get']
>

/** The shared library. Defined once, switched on per agent. */
export const useTools = createQuery<ToolsResponse>({
  queryKey: ['tools'],
  fetcher: async () => {
    const client = await api()
    return parseResponse<ToolsResponse>(await client.api.tools.$get())
  },
})

export const useToolAccess = createQuery<AccessResponse, { agentId: string }>({
  queryKey: ['tool-access'],
  fetcher: async ({ agentId }) => {
    const client = await api()
    return parseResponse<AccessResponse>(
      await client.api.tools.access[':agentId'].$get({ param: { agentId } }),
    )
  },
})
