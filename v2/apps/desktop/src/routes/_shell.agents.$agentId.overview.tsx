import { createFileRoute } from '@tanstack/react-router'
import { AgentPanel } from '@/components/shell/AgentPanel'
import { useAgents } from '@/modules/api/agents.hooks'
import { AgentOverview } from '@/screens/agent/AgentOverview'

export const Route = createFileRoute('/_shell/agents/$agentId/overview')({
  component: OverviewTab,
})

function OverviewTab() {
  const { agentId } = Route.useParams()
  const { data } = useAgents()
  const agent = data?.agents.find((a) => a.id === agentId)
  if (!agent) return null
  return (
    <AgentPanel agent={agent} tab="overview">
      <AgentOverview agent={agent} />
    </AgentPanel>
  )
}
