import { useNavigate } from '@tanstack/react-router'
import { Bot } from 'lucide-react'
import { CommandPalette } from '@/components/motion/command-palette'
import { useAgents } from '@/modules/api/agents.hooks'
import { closeOverlay } from '@/modules/navigation/overlay'

/**
 * A switcher, not a command runner.
 *
 * beui rather than beautifui's SearchList: that one takes a bare string list
 * with no select handler, so it can filter but cannot navigate. This is
 * controlled by the overlay search param, so the url opens and closes it.
 */
export function SearchOverlay() {
  const { data } = useAgents()
  const navigate = useNavigate()

  const items = (data?.agents ?? []).map((agent) => ({
    id: agent.id,
    label: agent.name,
    group: 'Agents',
    hint: agent.activity ?? undefined,
    keywords: [agent.acpAgent, agent.state],
    icon: Bot,
    onSelect: () => {
      navigate({
        to: '/agents/$agentId',
        params: { agentId: agent.id },
        search: closeOverlay,
      })
    },
  }))

  return (
    <CommandPalette
      open
      items={items}
      placeholder="Go to an agent"
      emptyMessage="No agent by that name."
      onOpenChange={(next) => {
        if (!next) navigate({ to: '.', search: closeOverlay })
      }}
    />
  )
}
