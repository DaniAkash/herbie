import { createFileRoute } from '@tanstack/react-router'
import { MobileTab } from '@/components/settings/MiscTabs'

export const Route = createFileRoute('/settings/mobile')({
  component: MobileTab,
})
