import { BrainIcon, CheckIcon, ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

  // TODO(reasoning-overlap): codex exposes effort twice — baked into the
  // model id (`gpt-5.5/medium`) AND as a separate `reasoning_effort`
  // config option, with no defined precedence. Hide the picker for
  // codex so the model id is the single source of truth; revisit once
  // we have more agents with the same dual-surface pattern and can pick
  // a generic rule (e.g. detect when every model id ends in
  // `/<reasoning-value>` and collapse the model picker instead).
  if (agentId === 'codex') return null

  if (!reasoning) return null

  // When the user hasn't picked, show the agent's own default if the
  // probe surfaced one — otherwise fall back to the literal word
  // 'default' so the chip never reads empty.
  const triggerLabel = value ?? reasoning.defaultValue ?? 'default'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <BrainIcon data-icon="inline-start" />
        <span className="text-xs capitalize">{triggerLabel}</span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Reasoning
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onChange(null)}
            className="flex items-center gap-2"
          >
            <span className="flex-1 text-muted-foreground italic">
              {reasoning.defaultValue
                ? `agent default — ${reasoning.defaultValue}`
                : 'agent default'}
            </span>
            {value === null && <CheckIcon className="size-4 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {reasoning.values.map((v) => (
            <DropdownMenuItem
              key={v}
              onClick={() => onChange(v)}
              className="flex items-center gap-2"
            >
              <span className="flex-1 text-sm capitalize">{v}</span>
              {value === v && <CheckIcon className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
