import type { Client } from '@bun/server/client'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'
import { queryClient } from '@/modules/api/queryClient'

export type ToolsResponse = InferResponseType<Client['api']['tools']['$get']>
export type AccessResponse = InferResponseType<
  Client['api']['tools']['access'][':agentId']['$get']
>
type AccessBody = InferRequestType<
  Client['api']['tools']['access'][':agentId']['$patch']
>['json']
type AccessPatched = InferResponseType<
  Client['api']['tools']['access'][':agentId']['$patch'],
  200
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

/**
 * Flips one switch.
 *
 * Optimistic with a rollback, because a switch is the one control where the
 * delay is the whole feel of it. The row written on the server is an upsert
 * on the unique index, so a quick double flip settles on one row rather than
 * racing two inserts.
 */
export const useSetToolAccess = createMutation({
  mutationFn: async ({
    agentId,
    ...body
  }: AccessBody & { agentId: string }) => {
    const client = await api()
    return parseResponse<AccessPatched>(
      await client.api.tools.access[':agentId'].$patch({
        param: { agentId },
        json: body,
      }),
    )
  },
  onMutate: async ({ agentId, kind, refId, enabled }) => {
    const key = useToolAccess.getKey({ agentId })
    await queryClient.cancelQueries({ queryKey: key })
    const previous = queryClient.getQueryData<AccessResponse>(key)
    queryClient.setQueryData<AccessResponse>(key, (old) => {
      if (!old) return old
      const has = old.access.some((a) => a.kind === kind && a.refId === refId)
      return {
        ...old,
        access: has
          ? old.access.map((a) =>
              a.kind === kind && a.refId === refId ? { ...a, enabled } : a,
            )
          : [
              ...old.access,
              {
                agentId,
                kind,
                refId,
                enabled,
                updatedAt: new Date().toISOString(),
              },
            ],
      }
    })
    // Recomputed in onError rather than carried here: getKey returns a branded
    // tuple, and that brand would make this mutation's inferred type reference
    // a symbol nothing outside Kit can name.
    return { previous }
  },
  onError: (_error, { agentId }, context) => {
    if (context?.previous) {
      queryClient.setQueryData(
        useToolAccess.getKey({ agentId }),
        context.previous,
      )
    }
  },
  onSettled: (_data, _error, { agentId }) =>
    queryClient.invalidateQueries({
      queryKey: useToolAccess.getKey({ agentId }),
    }),
})
