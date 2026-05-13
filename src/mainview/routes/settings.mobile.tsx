import { createFileRoute } from '@tanstack/react-router'
import { MobileTab } from '@/components/settings/MobileTab'

export const Route = createFileRoute('/settings/mobile')({
  component: MobileTab,
})
