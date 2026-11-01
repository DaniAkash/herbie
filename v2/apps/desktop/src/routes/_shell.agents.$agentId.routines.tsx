import { createFileRoute } from '@tanstack/react-router'
import { AgentPanel } from '@/components/shell/AgentPanel'
import { useAgents, useRoutines } from '@/modules/api/agents.hooks'
import { AgentRoutines } from '@/screens/agent/AgentRoutines'

export const Route = createFileRoute('/_shell/agents/$agentId/routines')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      useRoutines.getFetchOptions({ agentId: params.agentId }),
    ),
  component: RoutinesTab,
})

function RoutinesTab() {
  const { agentId } = Route.useParams()
  const { data } = useAgents()
  const agent = data?.agents.find((a) => a.id === agentId)
  if (!agent) return null
  return (
    <AgentPanel agent={agent} tab="routines">
      <AgentRoutines agentId={agentId} />
    </AgentPanel>
  )
}
