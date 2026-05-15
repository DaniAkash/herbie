import { CheckIcon, ChevronDownIcon, CpuIcon } from 'lucide-react'
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

export interface ModelPickerProps {
  agentId: AgentId
  value: string | null
  onChange: (modelId: string | null) => void
}

export function ModelPicker({ agentId, value, onChange }: ModelPickerProps) {
  const { data, isLoading } = useAgentCapabilities({
    variables: { id: agentId },
  })
  const models = data?.models ?? []
  const hasModels = models.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!hasModels}
        render={<Button variant="ghost" size="sm" />}
      >
        <CpuIcon data-icon="inline-start" />
        <span className="font-mono text-xs">
          {value ?? (isLoading ? 'loading…' : 'default')}
        </span>
        {hasModels && (
          <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Model
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onChange(null)}
            className="flex items-center gap-2"
          >
            <span className="flex-1 text-muted-foreground italic">
              agent default
            </span>
            {value === null && <CheckIcon className="size-4 text-primary" />}
          </DropdownMenuItem>
          {models.length > 0 && <DropdownMenuSeparator />}
          {models.map((m) => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => onChange(m.id)}
              className="flex items-start gap-2"
            >
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-mono text-xs">{m.name ?? m.id}</span>
                {m.description && (
                  <span className="text-[10px] text-muted-foreground">
                    {m.description}
                  </span>
                )}
              </div>
              {value === m.id && (
                <CheckIcon className="mt-0.5 size-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
