import { BrainIcon, CheckIcon, ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAgentCapabilities } from '@/modules/api/agents.hooks'
import type { AgentId } from '@/modules/data/herbie-data.types'

export interface ReasoningPickerProps {
  agentId: AgentId
  value: string | null
  onChange: (reasoning: string | null) => void
}

// Renders nothing if the agent's capability response doesn't carry a
// `reasoning` block — agents without it have no way to set a reasoning
// effort over ACP today.
export function ReasoningPicker({
  agentId,
  value,
  onChange,
}: ReasoningPickerProps) {
  const { data } = useAgentCapabilities({ variables: { id: agentId } })
  const reasoning = data?.reasoning
  if (!reasoning) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <BrainIcon data-icon="inline-start" />
        <span className="text-xs capitalize">{value ?? 'default'}</span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Reasoning
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onChange(null)}
          className="flex items-center gap-2"
        >
          <span className="flex-1 text-muted-foreground italic">
            agent default
          </span>
          {value === null && <CheckIcon className="size-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {reasoning.values.map((v) => (
          <DropdownMenuItem
            key={v}
            onSelect={() => onChange(v)}
            className="flex items-center gap-2"
          >
            <span className="flex-1 text-sm capitalize">{v}</span>
            {value === v && <CheckIcon className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
