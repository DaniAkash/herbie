import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { AnimatePresence } from 'motion/react'
import { AgentPanel } from '@/components/shell/AgentPanel'
import { useAgents } from '@/modules/api/agents.hooks'
import { Conversation } from '@/screens/conversation/Conversation'

/**
 * Two regions from one route: the conversation, and an Outlet the panel tabs
 * fill. The grid's third column is `auto`, so it takes no width when no tab
 * is open.
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

const PANEL_TAB = /\/(overview|routines|permissions)$/

function AgentRoute() {
  const { agentId } = Route.useParams()
  const { pathname } = useLocation()
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
      {/*
        The panel is this route's layout for its tab routes, and it has to be
        rendered here rather than by a layout route of its own: a component
        cannot animate its own unmount, so the shell must outlive the route
        that goes away. AnimatePresence holds it until its exit has played,
        with the chrome still on screen while it collapses. Only the body
        inside the Outlet belongs to the tab that just closed.
      */}
      <AnimatePresence initial={false}>
        {PANEL_TAB.test(pathname) ? (
          <AgentPanel key="agent-panel">
            <Outlet />
          </AgentPanel>
        ) : null}
      </AnimatePresence>
    </>
  )
}
