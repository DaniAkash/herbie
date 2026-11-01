import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AgentPanel } from '@/components/shell/AgentPanel'

/**
 * The panel's own layout.
 *
 * Pathless, so the url stays /agents/$agentId/overview while the chrome
 * above the tabs belongs to one route rather than being rebuilt by each of
 * them. The face, the name and the tab list mount once and stay mounted as
 * you move between tabs; only the Outlet below them changes.
 */
export const Route = createFileRoute('/_shell/agents/$agentId/_panel')({
  component: () => (
    <AgentPanel>
      <Outlet />
    </AgentPanel>
  ),
})
