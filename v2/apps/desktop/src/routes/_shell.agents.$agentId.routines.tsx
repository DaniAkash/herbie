import { createFileRoute } from '@tanstack/react-router'
import { useAgent, useRoutines } from '@/modules/api/agents.hooks'
import { AgentRoutines } from '@/screens/agent/AgentRoutines'

/** Content only. The chrome around it belongs to the _panel layout. */
export const Route = createFileRoute('/_shell/agents/$agentId/routines')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      useRoutines.getFetchOptions({ agentId: params.agentId }),
    ),
  component: RoutinesTab,
})

function RoutinesTab() {
  const { agentId } = Route.useParams()
  // Named, because the empty state asks the person to talk to this agent by
  // name and "ask the agent" reads like a manual.
  const agent = useAgent(agentId)
  return <AgentRoutines agentId={agentId} agentName={agent?.name ?? 'it'} />
}
