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

const AGENT_LABELS: Record<AgentId, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
  hermes: 'Hermes',
}

const AGENT_IDS: AgentId[] = ['claude', 'codex', 'gemini', 'hermes']

export interface AgentPickerProps {
  value: AgentId
  onChange: (agent: AgentId) => void
}

export function AgentPicker({ value, onChange }: AgentPickerProps) {
  const { data: detections } = useAgents()
  const detectionMap = new Map(
    (detections ?? []).map((d) => [d.agentId, d] as const),
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <SparklesIcon data-icon="inline-start" />
        <span>{AGENT_LABELS[value]}</span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Agent
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {AGENT_IDS.map((id) => {
            const detection = detectionMap.get(id)
            const installState = detection?.installState ?? 'not-installed'
            return (
              <DropdownMenuItem
                key={id}
                onClick={() => onChange(id)}
                className="flex items-center gap-2 py-2"
              >
                <span className="flex-1 font-medium text-sm">
                  {AGENT_LABELS[id]}
                </span>
                {installState === 'npx-available' && (
                  <Badge variant="outline" className="text-[9px]">
                    npx
                  </Badge>
                )}
                {installState === 'not-installed' && (
                  <Badge variant="outline" className="text-[9px]">
                    install
                  </Badge>
                )}
                {value === id && <CheckIcon className="size-4 text-primary" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
