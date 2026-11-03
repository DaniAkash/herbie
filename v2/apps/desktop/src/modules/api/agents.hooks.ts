import type { Client } from '@bun/server/client'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'
import { queryClient } from '@/modules/api/queryClient'

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
export type RulesResponse = InferResponseType<
  Client['api']['agents'][':id']['rules']['$get']
>

/**
 * The draft shapes are the validators' shapes, taken from the route tree.
 *
 * Declaring them by hand here is what lets a renamed column stay compiling on
 * one side and break at runtime on the other.
 */
type CreateAgentBody = InferRequestType<
  Client['api']['agents']['$post']
>['json']
type PatchAgentBody = InferRequestType<
  Client['api']['agents'][':id']['$patch']
>['json']
type CreateRoutineBody = InferRequestType<
  Client['api']['agents'][':id']['routines']['$post']
>['json']
type PatchRoutineBody = InferRequestType<
  Client['api']['routines'][':id']['$patch']
>['json']

type CreatedAgent = InferResponseType<Client['api']['agents']['$post'], 201>
type PatchedAgent = InferResponseType<
  Client['api']['agents'][':id']['$patch'],
  200
>
type CreatedRoutine = InferResponseType<
  Client['api']['agents'][':id']['routines']['$post'],
  201
>
type PatchedRoutine = InferResponseType<
  Client['api']['routines'][':id']['$patch'],
  200
>
type CreatedRule = InferResponseType<
  Client['api']['agents'][':id']['rules']['$post'],
  201
>

/** Every agent, for the rail. Loaded once by the shell and read everywhere. */
export const useAgents = createQuery<AgentsResponse>({
  queryKey: ['agents'],
  fetcher: async () => {
    const client = await api()
    return parseResponse<AgentsResponse>(await client.api.agents.$get())
  },
})

/** One agent out of the rail's list, which every panel tab needs. */
export function useAgent(agentId: string): Agent | undefined {
  const { data } = useAgents()
  return data?.agents.find((a) => a.id === agentId)
}

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

export const useRules = createQuery<RulesResponse, { agentId: string }>({
  queryKey: ['agent-rules'],
  fetcher: async ({ agentId }) => {
    const client = await api()
    return parseResponse<RulesResponse>(
      await client.api.agents[':id'].rules.$get({ param: { id: agentId } }),
    )
  },
})

/**
 * Creates an agent.
 *
 * Deliberately not optimistic. A new agent appearing in the rail before the
 * sidecar has made its folder is a worse lie than a moment of waiting, and
 * the id it comes back with is the server's to decide.
 */
export const useCreateAgent = createMutation({
  mutationFn: async (draft: CreateAgentBody) => {
    const client = await api()
    return parseResponse<CreatedAgent>(
      await client.api.agents.$post({ json: draft }),
    )
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: useAgents.getKey() })
    queryClient.invalidateQueries({ queryKey: ['runtimes'] })
  },
})

export const usePatchAgent = createMutation({
  mutationFn: async ({ id, ...patch }: PatchAgentBody & { id: string }) => {
    const client = await api()
    return parseResponse<PatchedAgent>(
      await client.api.agents[':id'].$patch({ param: { id }, json: patch }),
    )
  },
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: useAgents.getKey() }),
})

export const useDeleteAgent = createMutation({
  mutationFn: async ({ id }: { id: string }) => {
    const client = await api()
    return parseResponse<{ deleted: true }>(
      await client.api.agents[':id'].$delete({ param: { id } }),
    )
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: useAgents.getKey() })
    queryClient.invalidateQueries({ queryKey: ['runtimes'] })
  },
})

export const useCreateRoutine = createMutation({
  mutationFn: async ({
    agentId,
    ...body
  }: CreateRoutineBody & { agentId: string }) => {
    const client = await api()
    return parseResponse<CreatedRoutine>(
      await client.api.agents[':id'].routines.$post({
        param: { id: agentId },
        json: body,
      }),
    )
  },
  onSuccess: (_data, { agentId }) =>
    queryClient.invalidateQueries({
      queryKey: useRoutines.getKey({ agentId }),
    }),
})

/**
 * Edits a routine, most often its switch.
 *
 * Optimistic, because a switch that waits for a round trip before it moves
 * reads as broken. The rollback is what makes that honest: if the write
 * fails the switch goes back rather than lying about what was saved.
 */
export const usePatchRoutine = createMutation({
  mutationFn: async ({
    id,
    agentId: _agentId,
    ...patch
  }: PatchRoutineBody & { id: string; agentId: string }) => {
    const client = await api()
    return parseResponse<PatchedRoutine>(
      await client.api.routines[':id'].$patch({ param: { id }, json: patch }),
    )
  },
  onMutate: async ({ id, agentId, ...patch }) => {
    const key = useRoutines.getKey({ agentId })
    await queryClient.cancelQueries({ queryKey: key })
    const previous = queryClient.getQueryData<RoutinesResponse>(key)
    queryClient.setQueryData<RoutinesResponse>(key, (old) =>
      old
        ? {
            ...old,
            routines: old.routines.map((r) =>
              r.id === id ? { ...r, ...patch } : r,
            ),
          }
        : old,
    )
    // The key is recomputed rather than carried in the context: getKey returns
    // a branded tuple, and a branded type in the context makes the mutation's
    // own inferred type reference a symbol nothing outside Kit can name.
    return { previous }
  },
  onError: (_error, { agentId }, context) => {
    if (context?.previous) {
      queryClient.setQueryData(
        useRoutines.getKey({ agentId }),
        context.previous,
      )
    }
  },
  onSettled: (_data, _error, { agentId }) =>
    queryClient.invalidateQueries({
      queryKey: useRoutines.getKey({ agentId }),
    }),
})

export const useDeleteRoutine = createMutation({
  mutationFn: async ({ id }: { id: string; agentId: string }) => {
    const client = await api()
    return parseResponse<{ deleted: true }>(
      await client.api.routines[':id'].$delete({ param: { id } }),
    )
  },
  onSuccess: (_data, { agentId }) =>
    queryClient.invalidateQueries({
      queryKey: useRoutines.getKey({ agentId }),
    }),
})

export const useCreateRule = createMutation({
  mutationFn: async ({
    agentId,
    kind,
    phrase,
  }: {
    agentId: string
    kind: 'ask' | 'allow'
    phrase: string
  }) => {
    const client = await api()
    return parseResponse<CreatedRule>(
      await client.api.agents[':id'].rules.$post({
        param: { id: agentId },
        json: { kind, phrase },
      }),
    )
  },
  onSuccess: (_data, { agentId }) =>
    queryClient.invalidateQueries({ queryKey: useRules.getKey({ agentId }) }),
})

export const useDeleteRule = createMutation({
  mutationFn: async ({ id }: { id: string; agentId: string }) => {
    const client = await api()
    return parseResponse<{ deleted: true }>(
      await client.api.rules[':id'].$delete({ param: { id } }),
    )
  },
  onSuccess: (_data, { agentId }) =>
    queryClient.invalidateQueries({ queryKey: useRules.getKey({ agentId }) }),
})
