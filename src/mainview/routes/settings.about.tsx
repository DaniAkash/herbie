import { createFileRoute } from '@tanstack/react-router'
import { AboutTab } from '@/components/settings/MiscTabs'

export const Route = createFileRoute('/settings/about')({
  component: AboutTab,
})
