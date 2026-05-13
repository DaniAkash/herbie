import { createFileRoute } from '@tanstack/react-router'
import { SkillsTab } from '@/components/settings/SkillsTab'

export const Route = createFileRoute('/settings/skills')({
  component: SkillsTab,
})
