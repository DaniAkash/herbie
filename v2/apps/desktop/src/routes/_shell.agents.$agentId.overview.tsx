import { createFileRoute } from '@tanstack/react-router'
import { useAgents } from '@/modules/api/agents.hooks'
import { AgentOverview } from '@/screens/agent/AgentOverview'

/** Content only. The chrome around it belongs to the _panel layout. */
export const Route = createFileRoute('/_shell/agents/$agentId/overview')({
  component: OverviewTab,
})

function OverviewTab() {
  const { agentId } = Route.useParams()
  const { data } = useAgents()
  const agent = data?.agents.find((a) => a.id === agentId)
  if (!agent) return null
  return <AgentOverview agent={agent} />
}
