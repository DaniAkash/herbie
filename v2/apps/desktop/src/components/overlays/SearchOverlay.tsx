import { AnimateIcon } from '@animate-ui/react/icons'
import { useNavigate } from '@tanstack/react-router'
import { Bot } from '@/components/animate-ui/icons/bot'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { useAgents } from '@/modules/api/agents.hooks'
import { closeOverlay } from '@/modules/navigation/overlay'

/**
 * A switcher, not a command runner.
 *
 * Controlled by the overlay search param, so the url opens and closes it.
 */
export function SearchOverlay() {
  const { data } = useAgents()
  const navigate = useNavigate()
  const agents = data?.agents ?? []

  return (
    <CommandDialog
      open
      title="Go to an agent"
      description="Search your agents by name."
      className="top-[18vh] sm:max-w-xl"
      onOpenChange={(next) => {
        if (!next) navigate({ to: '.', search: closeOverlay })
      }}
    >
      <CommandInput placeholder="Go to an agent" />
      <CommandList>
        <CommandEmpty>No agent by that name.</CommandEmpty>
        <CommandGroup heading="Agents">
          {agents.map((agent) => (
            <AnimateIcon key={agent.id} animateOnHover asChild>
              <CommandItem
                value={agent.name}
                keywords={[agent.acpAgent, agent.state]}
                onSelect={() => {
                  navigate({
                    to: '/agents/$agentId',
                    params: { agentId: agent.id },
                    search: closeOverlay,
                  })
                }}
              >
                <Bot className="text-ink-3" />
                <span className="min-w-0 truncate">{agent.name}</span>
                {agent.activity ? (
                  <CommandShortcut className="min-w-0 truncate tracking-normal">
                    {agent.activity}
                  </CommandShortcut>
                ) : null}
              </CommandItem>
            </AnimateIcon>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
