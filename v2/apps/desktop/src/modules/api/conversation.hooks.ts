import { createMutation } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'
import { queryClient } from '@/modules/api/queryClient'

/**
 * Sends a message.
 *
 * Deliberately not optimistic. The `user` record comes back over the stream
 * within a round trip, and showing it twice while the real one arrives is a
 * worse lie than the moment of waiting. A 409 means a turn is already
 * running, which the composer surfaces rather than retrying.
 */
export const useSendTurn = createMutation({
  mutationFn: async ({ agentId, text }: { agentId: string; text: string }) => {
    const client = await api()
    const response = await client.api.agents[':id'].turns.$post({
      param: { id: agentId },
      json: { text },
    })
    return parseResponse<{ turnId: string }>(response)
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
})

export const useCancelTurn = createMutation({
  mutationFn: async ({
    agentId,
    reason,
  }: {
    agentId: string
    reason?: string
  }) => {
    const client = await api()
    return parseResponse<{ cancelled: boolean }>(
      await client.api.agents[':id'].turns.cancel.$post({
        param: { id: agentId },
        json: reason === undefined ? {} : { reason },
      }),
    )
  },
})

/** Answers an `ask` block. The agent is blocked until this lands. */
export const useAnswer = createMutation({
  mutationFn: async ({
    agentId,
    recordId,
    answers,
  }: {
    agentId: string
    recordId: string
    answers: Record<string, number[]>
  }) => {
    const client = await api()
    return parseResponse<{ answered: true }>(
      await client.api.agents[':id'].answers[':recordId'].$post({
        param: { id: agentId, recordId },
        json: { answers },
      }),
    )
  },
})

/** Settles a permission request with one of the agent's own options. */
export const useDecide = createMutation({
  mutationFn: async ({
    agentId,
    requestId,
    recordId,
    optionId,
  }: {
    agentId: string
    requestId: string
    recordId: string
    optionId: string
  }) => {
    const client = await api()
    return parseResponse<{ decided: true }>(
      await client.api.agents[':id'].permissions[':requestId'].$post({
        param: { id: agentId, requestId },
        json: { optionId, recordId },
      }),
    )
  },
})
