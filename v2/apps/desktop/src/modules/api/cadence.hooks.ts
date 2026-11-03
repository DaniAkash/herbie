import type { Client } from '@bun/server/client'
import type { InferResponseType } from 'hono/client'
import { createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'

// Pinned to 200: the validator adds a 400 branch, and the union of the two
// has no `cadence` on it.
type CadenceResponse = InferResponseType<Client['api']['cadence']['$post'], 200>

/**
 * Reads a cadence without committing to it.
 *
 * Keyed on the text rather than asked as a mutation, so an answer can only
 * be read against the phrase that asked for it. Two keystrokes can be in
 * flight at once, and a mutation keeps whichever lands last, which is how a
 * cron for `every day at eight` ended up sitting under `every day at ten`.
 *
 * A parse is deterministic, so an answer never goes stale, and the default
 * collection time is what clears the half typed phrases nobody asks about
 * twice.
 */
export const useCadence = createQuery<CadenceResponse, { text: string }>({
  queryKey: ['cadence'],
  fetcher: async ({ text }) => {
    const client = await api()
    return parseResponse<CadenceResponse>(
      await client.api.cadence.$post({ json: { text } }),
    )
  },
  staleTime: Number.POSITIVE_INFINITY,
})
