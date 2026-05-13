import { createFileRoute } from '@tanstack/react-router'
import { RegistryTab } from '@/components/settings/RegistryTab'

export const Route = createFileRoute('/settings/registry')({
  component: RegistryTab,
})
