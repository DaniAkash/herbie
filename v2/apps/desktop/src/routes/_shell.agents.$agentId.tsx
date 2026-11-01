import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useAgents } from '@/modules/api/agents.hooks'
import { Conversation } from '@/screens/conversation/Conversation'

/**
 * Two regions from one route: the conversation, and an Outlet the panel tabs
 * fill. The grid's third column is `auto`, so it collapses when the index
 * child renders nothing.
 */
export const Route = createFileRoute('/_shell/agents/$agentId')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(useAgents.getFetchOptions()),
  component: AgentRoute,
  notFoundComponent: () => (
    <section className="grid place-items-center p-10 text-center">
      <p className="text-ink-2">
        That agent is gone. Pick another from the rail.
      </p>
    </section>
  ),
})

function AgentRoute() {
  const { agentId } = Route.useParams()
  const { data } = useAgents()
  const agent = data?.agents.find((a) => a.id === agentId)

  if (!agent) {
    return (
      <section className="grid place-items-center p-10 text-center">
        <p className="text-ink-2">
          No agent called {agentId}. Pick another from the rail.
        </p>
      </section>
    )
  }

  return (
    <>
      <Conversation agent={agent} />
      <Outlet />
    </>
  )
}
