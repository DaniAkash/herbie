import { createFileRoute } from '@tanstack/react-router'
import { SettingsLayout } from '@/screens/settings/SettingsLayout'

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
})
