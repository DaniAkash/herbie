import {
  BrainIcon,
  CheckIcon,
  ChevronDownIcon,
  CpuIcon,
  FolderIcon,
  PlusIcon,
  SparklesIcon,
} from 'lucide-react'
import { useMemo } from 'react'
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
import { useAgentCapabilities, useAgents } from '@/modules/api/agents.hooks'
import { useWorkspaces } from '@/modules/api/settings.hooks'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { pickDirectory } from '@/modules/system/pickDirectory'

// Picker dropdowns scoped to the Mobile settings tab. Kept separate
// from the chat composer pickers because those carry
// tuple-mid-conversation semantics (warning banners, change history)
// that don't apply here.

export function AgentSelect({
  value,
  onChange,
}: {
  value: AgentId
  onChange: (next: AgentId) => void
}) {
  const { data: detections = [] } = useAgents()
  const selectedLabel = useMemo(
    () => detections.find((d) => d.agentId === value)?.displayName ?? value,
    [detections, value],
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
          />
        }
      >
        <span className="flex items-center gap-2">
          <SparklesIcon className="size-3.5" />
          {selectedLabel}
        </span>
        <ChevronDownIcon className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Agent</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {detections.map((d) => (
            <DropdownMenuItem
              key={d.agentId}
              onClick={() => onChange(d.agentId)}
              disabled={d.installState === 'not-installed'}
            >
              <span className="flex-1">{d.displayName}</span>
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
              {d.installState === 'not-installed' && (
                <Badge variant="outline" className="text-[9px]">
                  install
                </Badge>
              )}
              {value === d.agentId && (
                <CheckIcon className="size-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ModelSelect({
  agentId,
  value,
  onChange,
}: {
  agentId: AgentId
  value: string | null
  onChange: (next: string | null) => void
}) {
  const { data, isLoading } = useAgentCapabilities({
    variables: { id: agentId },
  })
  const models = data?.models ?? []
  const disabled = models.length === 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
          />
        }
      >
        <span className="flex items-center gap-2">
          <CpuIcon className="size-3.5" />
          <span className="font-mono text-xs">
            {value ?? (isLoading ? 'loading…' : 'agent default')}
          </span>
        </span>
        {!disabled && <ChevronDownIcon className="size-3.5 opacity-60" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onChange(null)}>
            <span className="flex-1 text-muted-foreground italic">
              agent default
            </span>
            {value === null && <CheckIcon className="size-4 text-primary" />}
          </DropdownMenuItem>
          {models.length > 0 && <DropdownMenuSeparator />}
          {models.map((m) => (
            <DropdownMenuItem key={m.id} onClick={() => onChange(m.id)}>
              <span className="flex-1 font-mono text-xs">{m.name ?? m.id}</span>
              {value === m.id && <CheckIcon className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function WorkspaceSelect({
  value,
  defaultPath,
  onChange,
}: {
  value: string | null
  defaultPath: string | null
  onChange: (next: string | null) => void
}) {
  const { recent, addRecent } = useWorkspaces()
  const effective = value ?? defaultPath

  async function handlePick() {
    const picked = await pickDirectory()
    if (!picked) return
    addRecent(picked)
    onChange(picked)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
          />
        }
      >
        <span className="flex items-center gap-2 truncate">
          <FolderIcon className="size-3.5 shrink-0" />
          <span className="truncate font-mono text-xs">
            {effective ?? 'pick a workspace…'}
          </span>
        </span>
        <ChevronDownIcon className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspace</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {defaultPath && (
            <DropdownMenuItem onClick={() => onChange(null)}>
              <span className="flex-1 truncate">
                <span className="font-medium">{defaultPath}</span>
                <span className="ml-1 text-muted-foreground text-xs">
                  (default)
                </span>
              </span>
              {value === null && <CheckIcon className="size-4 text-primary" />}
            </DropdownMenuItem>
          )}
          {recent.length > 0 && <DropdownMenuSeparator />}
          {recent.map((p) => (
            <DropdownMenuItem key={p} onClick={() => onChange(p)}>
              <span className="flex-1 truncate font-mono text-xs">{p}</span>
              {value === p && <CheckIcon className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              void handlePick()
            }}
          >
            <PlusIcon className="size-3.5" />
            <span className="text-sm">Pick directory…</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ReasoningSelect({
  agentId,
  value,
  onChange,
}: {
  agentId: AgentId
  value: string | null
  onChange: (next: string | null) => void
}) {
  const { data } = useAgentCapabilities({ variables: { id: agentId } })
  const reasoning = data?.reasoning
  const disabled = !reasoning

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
          />
        }
      >
        <span className="flex items-center gap-2">
          <BrainIcon className="size-3.5" />
          <span className="text-xs capitalize">
            {value ?? (disabled ? 'not supported' : 'agent default')}
          </span>
        </span>
        {!disabled && <ChevronDownIcon className="size-3.5 opacity-60" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Reasoning</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onChange(null)}>
            <span className="flex-1 text-muted-foreground italic">
              agent default
            </span>
            {value === null && <CheckIcon className="size-4 text-primary" />}
          </DropdownMenuItem>
          {(reasoning?.values ?? []).map((v) => (
            <DropdownMenuItem key={v} onClick={() => onChange(v)}>
              <span className="flex-1 text-sm capitalize">{v}</span>
              {value === v && <CheckIcon className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
