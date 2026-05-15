import { CheckIcon, ChevronDownIcon, SparklesIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { useAgents } from '@/modules/api/agents.hooks'
import type { AgentId } from '@/modules/data/herbie-data.types'

export interface AgentPickerProps {
  value: AgentId
  onChange: (agent: AgentId) => void
}

// All labels come from detect.ts now. Built-in agents carry their
// display names via the registry's overlay; custom agents (Phase 2)
// carry their user-chosen displayName. Stale rows for an
// uninstalled-and-detected-not-installed agent still show the label
// from the registry overlay.
export function AgentPicker({ value, onChange }: AgentPickerProps) {
  const { data: detections = [] } = useAgents()

  // Hide not-installed agents — the full list lives in Settings →
  // Agents. Showing them here just makes the menu tall without
  // adding usable choices.
  const usable = detections.filter((d) => d.installState !== 'not-installed')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <SparklesIcon data-icon="inline-start" />
        <span>{labelFor(value, detections)}</span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Agent
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {usable.map((d) => (
            <DropdownMenuItem
              key={d.agentId}
              onClick={() => onChange(d.agentId)}
              className="flex items-center gap-2 py-2"
            >
              <span className="flex-1 font-medium text-sm">
                {d.displayName}
              </span>
              {d.custom && (
                <Badge variant="outline" className="text-[9px]">
                  custom
                </Badge>
              )}
              {d.installState === 'npx-available' && (
                <Badge variant="outline" className="text-[9px]">
                  npx
                </Badge>
              )}
              {value === d.agentId && (
                <CheckIcon className="size-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
          Add more agents in Settings → Agents.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function labelFor(
  id: AgentId,
  detections: ReadonlyArray<{ agentId: string; displayName: string }>,
): string {
  return detections.find((d) => d.agentId === id)?.displayName ?? id
}
