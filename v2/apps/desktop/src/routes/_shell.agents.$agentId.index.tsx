import { createFileRoute } from '@tanstack/react-router'

/** The panel is closed. Renders nothing so its grid column collapses. */
export const Route = createFileRoute('/_shell/agents/$agentId/')({
  component: () => null,
})
