import type { Client } from '@bun/server/client'
import type { InferResponseType } from 'hono/client'
import { createMutation } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'

// Pinned to 200: the validator adds a 400 branch, and the union of the two
// has no `cadence` on it.
export type CadenceResponse = InferResponseType<
  Client['api']['cadence']['$post'],
  200
>
export type ReadCadence = CadenceResponse['cadence']

/**
 * Reads a cadence without committing to it.
 *
 * A mutation rather than a query even though it changes nothing: it is a
 * question asked on each keystroke, and caching an answer per phrase would
 * fill the cache with half typed sentences nobody will ask about again.
 */
export const useReadCadence = createMutation({
  mutationFn: async ({ text }: { text: string }) => {
    const client = await api()
    return parseResponse<CadenceResponse>(
      await client.api.cadence.$post({ json: { text } }),
    )
  },
})
