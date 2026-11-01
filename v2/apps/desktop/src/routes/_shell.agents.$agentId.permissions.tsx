import { createFileRoute } from '@tanstack/react-router'
import { AgentPanel } from '@/components/shell/AgentPanel'
import { useAgents } from '@/modules/api/agents.hooks'
import { useToolAccess, useTools } from '@/modules/api/tools.hooks'
import { AgentPermissions } from '@/screens/agent/AgentPermissions'

export const Route = createFileRoute('/_shell/agents/$agentId/permissions')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(useTools.getFetchOptions()),
      context.queryClient.ensureQueryData(
        useToolAccess.getFetchOptions({ agentId: params.agentId }),
      ),
    ]),
  component: PermissionsTab,
})

function PermissionsTab() {
  const { agentId } = Route.useParams()
  const { data } = useAgents()
  const agent = data?.agents.find((a) => a.id === agentId)
  if (!agent) return null
  return (
    <AgentPanel agent={agent} tab="permissions">
      <AgentPermissions agentId={agentId} />
    </AgentPanel>
  )
}
