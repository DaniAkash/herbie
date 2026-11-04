import type { Client } from '@bun/server/client'
import type { InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'
import { queryClient } from '@/modules/api/queryClient'

export type RuntimesResponse = InferResponseType<
  Client['api']['runtimes']['$get']
>
export type Runtime = RuntimesResponse['runtimes'][number]
type ProbeResponse = InferResponseType<
  Client['api']['runtimes'][':id']['probe']['$post'],
  200
>

/** What each coding agent is, and whether it can be used right now. */
export const useRuntimes = createQuery<RuntimesResponse>({
  queryKey: ['runtimes'],
  fetcher: async () => {
    const client = await api()
    return parseResponse<RuntimesResponse>(await client.api.runtimes.$get())
  },
})

/**
 * Asks one runtime what it can do, and stores the answer.
 *
 * Separate from the list on purpose: listing is cheap and happens whenever a
 * picker opens, while this spawns the agent and is only worth doing for the
 * one that was actually chosen.
 */
export const useProbeRuntime = createMutation({
  // Named so a caller that does not hold the mutation can still see one in
  // flight: the create overlay's footer has to wait for a probe started two
  // components away.
  mutationKey: ['probe-runtime'],
  mutationFn: async ({ id }: { id: string }) => {
    const client = await api()
    return parseResponse<ProbeResponse>(
      await client.api.runtimes[':id'].probe.$post({ param: { id } }),
    )
  },
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: useRuntimes.getKey() }),
})
