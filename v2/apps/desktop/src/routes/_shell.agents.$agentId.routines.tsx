import { createFileRoute } from '@tanstack/react-router'
import { AgentPanel } from '@/components/shell/AgentPanel'
import { useRoutines } from '@/modules/api/agents.hooks'
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
  return (
    <AgentPanel tab="routines">
      <AgentRoutines agentId={agentId} />
    </AgentPanel>
  )
}
