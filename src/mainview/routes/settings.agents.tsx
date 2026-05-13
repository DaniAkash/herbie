import { createFileRoute } from '@tanstack/react-router'
import { AgentsTab } from '@/components/settings/AgentsTab'

export const Route = createFileRoute('/settings/agents')({
  component: AgentsTab,
})
