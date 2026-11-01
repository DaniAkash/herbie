import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAgents } from '@/modules/api/agents.hooks'

/**
 * Never renders. Sends you to an agent, or to the first run screen.
 *
 * Redirecting rather than branching inside the conversation keeps the empty
 * state a route of its own, which is what makes it reachable and testable.
 */
export const Route = createFileRoute('/_shell/')({
  loader: async ({ context }) => {
    const { agents } = await context.queryClient.ensureQueryData(
      useAgents.getFetchOptions(),
    )
    const first = agents.at(0)
    throw redirect(
      first
        ? { to: '/agents/$agentId', params: { agentId: first.id } }
        : { to: '/welcome' },
    )
  },
})
