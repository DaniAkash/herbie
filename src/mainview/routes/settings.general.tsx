import { createFileRoute } from '@tanstack/react-router'
import { GeneralTab } from '@/components/settings/GeneralTab'

export const Route = createFileRoute('/settings/general')({
  component: GeneralTab,
})
