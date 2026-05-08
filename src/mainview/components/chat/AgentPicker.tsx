import { CheckIcon, ChevronDownIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type { AgentId } from '@/modules/data/herbie-data.types'

type AgentPickerProps = {
  value: AgentId
  onChange: (agent: AgentId) => void
  variant?: 'pill' | 'header'
}

export function AgentPicker({
  value,
  onChange,
  variant = 'pill',
}: AgentPickerProps) {
  const { agents } = useHerbieData()
  const current = agents.find((a) => a.id === value) ?? agents[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant === 'pill' ? 'outline' : 'ghost'}
            size="sm"
            className={cn(
              'gap-1.5',
              variant === 'pill' && 'h-7 rounded-full px-2.5 text-xs',
              variant === 'header' && 'gap-2',
            )}
          />
        }
      >
        <SparklesIcon className="h-3.5 w-3.5" />
        <span>{current.label}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Pick an agent</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            onSelect={() => onChange(agent.id)}
            className="flex items-start gap-2 py-2"
          >
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sm">{agent.label}</span>
                {agent.status === 'signin-required' && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-[10px] text-amber-600 dark:text-amber-400">
                    sign in
                  </span>
                )}
                {agent.status === 'not-installed' && (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
                    install
                  </span>
                )}
              </div>
              <div className="text-muted-foreground text-xs">{agent.blurb}</div>
            </div>
            {value === agent.id && <CheckIcon className="mt-0.5 h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
