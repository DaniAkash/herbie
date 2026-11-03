import { createFileRoute } from '@tanstack/react-router'
import { useAgents, useRules } from '@/modules/api/agents.hooks'
import { useToolAccess, useTools } from '@/modules/api/tools.hooks'
import { AgentPermissions } from '@/screens/agent/AgentPermissions'

/** Content only. The chrome around it belongs to the _panel layout. */
export const Route = createFileRoute('/_shell/agents/$agentId/permissions')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(useTools.getFetchOptions()),
      context.queryClient.ensureQueryData(
        useToolAccess.getFetchOptions({ agentId: params.agentId }),
      ),
      context.queryClient.ensureQueryData(
        useRules.getFetchOptions({ agentId: params.agentId }),
      ),
    ]),
  component: PermissionsTab,
})

function PermissionsTab() {
  const { agentId } = Route.useParams()
  const { data } = useAgents()
  const agent = data?.agents.find((a) => a.id === agentId)
  if (!agent) return null
  return <AgentPermissions agent={agent} />
}
