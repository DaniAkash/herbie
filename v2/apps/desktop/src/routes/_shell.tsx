import {
  createFileRoute,
  Outlet,
  retainSearchParams,
} from '@tanstack/react-router'
import { AgentRail } from '@/components/shell/AgentRail'
import { OverlayHost } from '@/components/shell/OverlayHost'
import { Titlebar } from '@/components/shell/Titlebar'
import { useAgents } from '@/modules/api/agents.hooks'
import { overlaySchema } from '@/modules/navigation/overlay'

/**
 * The layout that never unmounts.
 *
 * It owns the titlebar, the rail and the overlay host, so an overlay opening
 * cannot take the conversation down with it. The agent list is loaded here
 * once and read from cache by the rail, the search overlay and anything else
 * that needs it.
 */
export const Route = createFileRoute('/_shell')({
  validateSearch: overlaySchema,
  // So picking an agent out of Search keeps Search open behind it. Links that
  // should dismiss an overlay pass closeOverlay explicitly.
  search: { middlewares: [retainSearchParams(['overlay', 'server'])] },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(useAgents.getFetchOptions()),
  component: ShellLayout,
})

function ShellLayout() {
  const search = Route.useSearch()
  const { data } = useAgents()
  const agents = data?.agents ?? []

  return (
    <div className="relative grid h-dvh grid-rows-[auto_1fr] overflow-hidden bg-page">
      <Titlebar title="Herbie" />
      <div className="grid min-h-0 grid-cols-[224px_1fr_auto]">
        <AgentRail agents={agents} />
        <Outlet />
      </div>
      <OverlayHost search={search} />
    </div>
  )
}
