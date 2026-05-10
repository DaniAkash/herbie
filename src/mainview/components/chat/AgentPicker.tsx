import { CheckIcon, ChevronDownIcon, SparklesIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type { AgentId } from '@/modules/data/herbie-data.types'

export type AgentPickerProps = {
  value: AgentId
  onChange: (agent: AgentId) => void
  variant?: 'pill' | 'header'
  readOnly?: boolean
}

export function AgentPicker({
  value,
  onChange,
  variant = 'pill',
  readOnly,
}: AgentPickerProps) {
  const { agents } = useHerbieData()
  const current = agents.find((a) => a.id === value) ?? agents[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={readOnly}
        render={
          <Button
            variant={variant === 'pill' ? 'ghost' : 'outline'}
            size="sm"
          />
        }
      >
        <SparklesIcon data-icon="inline-start" />
        <span>{current.label}</span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Agents
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            onSelect={() => onChange(agent.id)}
            className="flex items-start gap-2 py-2.5"
          >
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sm">{agent.label}</span>
                {agent.status === 'signin-required' && (
                  <Badge variant="secondary" className="text-[9px]">
                    sign in
                  </Badge>
                )}
                {agent.status === 'not-installed' && (
                  <Badge variant="outline" className="text-[9px]">
                    install
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground text-xs">{agent.blurb}</div>
            </div>
            {value === agent.id && (
              <CheckIcon className="mt-0.5 size-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
