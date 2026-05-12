import {
  CheckIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SkillForm } from '@/components/settings/SkillForm'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAgents } from '@/modules/api/agents.hooks'
import {
  SKILLS_CAPABLE_AGENT_IDS,
  type Skill,
  type SkillsAgentId,
  useSkills,
} from '@/modules/api/skills.hooks'

const AGENT_LABELS: Record<SkillsAgentId, string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
  gemini: 'Gemini CLI',
}

export function SkillsTab() {
  const { skills, linksBySkill, isLoading, add, remove, link, unlink } =
    useSkills()
  const installedAgents = useInstalledSkillAgents()
  const [open, setOpen] = useState(false)
  const [installing, setInstalling] = useState(false)

  async function handleInstall(source: string): Promise<void> {
    setInstalling(true)
    try {
      await add(source)
      // add() throws on mutation failure (toastApiError surfaces it). On
      // success, close and toast.
      setOpen(false)
      toast.success('Skill installed', {
        description: 'Toggle agents on the row to pick who gets this skill.',
      })
    } catch {
      // Error toast already shown by the mutation's onError. Keep the
      // dialog open so the user can retry without retyping.
    } finally {
      setInstalling(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-sm">Skills</h2>
          <p className="text-muted-foreground text-xs">
            Install once, then choose which agents pick it up. Changes take
            effect on the next conversation.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon data-icon="inline-start" />
            Install skill
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <SkillForm onSubmit={handleInstall} isPending={installing} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      ) : skills.length === 0 ? (
        <EmptyState onAdd={() => setOpen(true)} />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
          {skills.map((skill) => (
            <SkillRow
              key={skill.name}
              skill={skill}
              linked={linksBySkill.get(skill.name) ?? EMPTY_LINK_SET}
              installedAgents={installedAgents}
              onLink={(agent) => link(skill.name, agent)}
              onUnlink={(agent) => unlink(skill.name, agent)}
              onRemove={() => remove(skill.name)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

const EMPTY_LINK_SET: ReadonlySet<SkillsAgentId> = new Set()

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Empty className="rounded-lg border border-dashed bg-card/40 py-10">
      <EmptyHeader>
        <EmptyTitle>No skills installed</EmptyTitle>
        <EmptyDescription>
          Install a skill to share instructions with your agents. Each agent
          only sees skills you explicitly enable for it.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          Install your first skill
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function SkillRow({
  skill,
  linked,
  installedAgents,
  onLink,
  onUnlink,
  onRemove,
}: {
  skill: Skill
  linked: ReadonlySet<SkillsAgentId>
  installedAgents: ReadonlySet<SkillsAgentId>
  onLink: (agent: SkillsAgentId) => void
  onUnlink: (agent: SkillsAgentId) => void
  onRemove: () => void
}) {
  const rowDisabled = skill.broken === true

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-sm">{skill.name}</span>
            {skill.broken && (
              <Badge variant="destructive" className="text-[10px]">
                Bundle missing
              </Badge>
            )}
          </div>
          {skill.description && (
            <span className="truncate text-muted-foreground text-xs">
              {skill.description}
            </span>
          )}
          <SourceLine source={skill.source} addedAt={skill.addedAt} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Skill actions" />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onRemove} variant="destructive">
                <Trash2Icon data-icon="inline-start" />
                Remove from Herbie
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {skill.broken && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Bundle missing on disk</AlertTitle>
          <AlertDescription>
            The workspace folder was removed outside Herbie. Reinstall from the
            source above to restore, or remove the entry from Herbie.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground text-xs">Available to:</span>
        <ToggleGroup
          multiple
          value={[...linked]}
          onValueChange={(next: string[]) => {
            const wanted = new Set(next as SkillsAgentId[])
            for (const agent of SKILLS_CAPABLE_AGENT_IDS) {
              if (wanted.has(agent) && !linked.has(agent)) onLink(agent)
              if (!wanted.has(agent) && linked.has(agent)) onUnlink(agent)
            }
          }}
          variant="outline"
          size="sm"
          disabled={rowDisabled}
        >
          {SKILLS_CAPABLE_AGENT_IDS.map((agent) => {
            const installed = installedAgents.has(agent)
            const item = (
              <ToggleGroupItem
                key={agent}
                value={agent}
                disabled={!installed || rowDisabled}
                aria-label={AGENT_LABELS[agent]}
              >
                {AGENT_LABELS[agent]}
                {linked.has(agent) && <CheckIcon data-icon="inline-end" />}
              </ToggleGroupItem>
            )
            if (installed) return item
            return (
              <Tooltip key={agent}>
                <TooltipTrigger render={item} />
                <TooltipContent>
                  {AGENT_LABELS[agent]} is not installed on this machine.
                </TooltipContent>
              </Tooltip>
            )
          })}
        </ToggleGroup>
      </div>
    </div>
  )
}

function SourceLine({
  source,
  addedAt,
}: {
  source: Skill['source']
  addedAt?: string
}) {
  const sourceLabel = source ? labelForSource(source) : null
  const added = addedAt ? relativeTime(addedAt) : null
  if (!sourceLabel && !added) return null
  return (
    <span className="truncate font-mono text-[11px] text-muted-foreground">
      {sourceLabel}
      {sourceLabel && added ? ' · ' : ''}
      {added && <span className="font-sans italic">added {added}</span>}
    </span>
  )
}

function labelForSource(source: NonNullable<Skill['source']>): string {
  if (source.kind === 'github') {
    return source.ref ? `${source.ownerRepo}#${source.ref}` : source.ownerRepo
  }
  if (source.kind === 'gitUrl') {
    return source.ref ? `${source.url}#${source.ref}` : source.url
  }
  return source.path
}

// One-line relative formatter so we don't add a date library for this.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const seconds = Math.floor((Date.now() - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

// Intersect SKILLS_CAPABLE_AGENT_IDS with the agents detect endpoint
// reports as installed (or npx-available — agents that fetch on first
// use can still receive a symlink; the catalog dir is fine to create).
function useInstalledSkillAgents(): ReadonlySet<SkillsAgentId> {
  const { data } = useAgents()
  return useMemo(() => {
    const installable = new Set<SkillsAgentId>()
    for (const row of data ?? []) {
      if (
        row.installState !== 'installed' &&
        row.installState !== 'npx-available'
      ) {
        continue
      }
      // Narrow Herbie agentId → skills-capable subset.
      if (
        row.agentId === 'claude' ||
        row.agentId === 'codex' ||
        row.agentId === 'gemini'
      ) {
        installable.add(row.agentId)
      }
    }
    return installable
  }, [data])
}
