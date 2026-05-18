import {
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
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
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type AgentDetection, useAgents } from '@/modules/api/agents.hooks'
import {
  type CustomAgent,
  type CustomAgentDraft,
  useCustomAgents,
  useDefaultAgent,
} from '@/modules/api/settings.hooks'
import { openExternal } from '@/modules/system/openExternal'
import { CustomAgentForm } from './CustomAgentForm'

export function AgentsTab() {
  const { defaultAgent, setDefaultAgent } = useDefaultAgent()
  const { data, isLoading } = useAgents()
  const customAgents = useCustomAgents()

  // Mirror the composer AgentPicker's grouping: anything not in
  // `not-installed` is usable today (the npx-available ones just fetch
  // on first use). The picker's filter is `installState !== 'not-installed'`,
  // so the settings page splits the same way.
  const rows = data ?? []
  const installed = rows.filter(
    (r) => r.installState === 'installed' && !r.custom,
  )
  const npxAvailable = rows.filter((r) => r.installState === 'npx-available')
  const notInstalled = rows.filter((r) => r.installState === 'not-installed')

  const pickerRows: AgentDetection[] = rows.filter(
    (r) => r.installState !== 'not-installed',
  )

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Default agent for new chats</h2>
        {pickerRows.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Install one of the supported agents below or add your own.
          </p>
        ) : (
          <ToggleGroup
            value={[defaultAgent]}
            onValueChange={(v: string[]) => v[0] && setDefaultAgent(v[0])}
            variant="outline"
          >
            {pickerRows.map((row) => (
              <ToggleGroupItem
                key={row.agentId}
                value={row.agentId}
                aria-label={row.displayName}
              >
                {row.displayName}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </section>

      <CustomAgentsSection
        agents={customAgents.agents}
        // Gate writes on the initial settings fetch — without this a
        // user could click Add the instant the section paints and the
        // mutation would PATCH `customAgents: [draft]` based on an
        // empty `agents` array, wiping any persisted customs.
        isLoading={customAgents.isLoading}
        onAdd={(draft) => {
          customAgents.add(draft)
          toast.success(`Added ${draft.displayName}`)
        }}
        onUpdate={(id, draft) => {
          customAgents.update(id, draft)
          toast.success(`Updated ${draft.displayName}`)
        }}
        onRemove={(agent) => {
          customAgents.remove(agent.id)
          toast.success(`Removed ${agent.displayName}`)
        }}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Built-in agents</h2>
        {isLoading || !data ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : (
          <div className="flex flex-col gap-4">
            {installed.length > 0 && (
              <AgentSection title="Installed" rows={installed} />
            )}
            {npxAvailable.length > 0 && (
              <AgentSection
                title="Auto-installs via npx"
                description="These agents fetch on first use. The first session takes a few extra seconds."
                rows={npxAvailable}
              />
            )}
            {notInstalled.length > 0 && (
              <AgentSection
                title="Not installed on this machine"
                rows={notInstalled}
              />
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function CustomAgentsSection({
  agents,
  isLoading,
  onAdd,
  onUpdate,
  onRemove,
}: {
  agents: CustomAgent[]
  isLoading: boolean
  onAdd: (draft: CustomAgentDraft) => void
  onUpdate: (id: string, draft: CustomAgentDraft) => void
  onRemove: (agent: CustomAgent) => void
}) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium text-sm">Custom agents</h2>
          <p className="text-muted-foreground text-xs">
            Bring your own ACP-compatible CLI. It shows up in the composer's
            agent picker alongside the built-ins.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger disabled={isLoading} render={<Button size="sm" />}>
            <PlusIcon data-icon="inline-start" />
            Add agent
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <CustomAgentForm
              onSubmit={(draft) => {
                onAdd(draft)
                setAddOpen(false)
              }}
              isPending={false}
            />
          </DialogContent>
        </Dialog>
      </div>
      {agents.length === 0 ? null : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
          {agents.map((agent) => (
            <CustomAgentRow
              key={agent.id}
              agent={agent}
              onUpdate={(draft) => onUpdate(agent.id, draft)}
              onRemove={() => onRemove(agent)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function CustomAgentRow({
  agent,
  onUpdate,
  onRemove,
}: {
  agent: CustomAgent
  onUpdate: (draft: CustomAgentDraft) => void
  onRemove: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">
            {agent.displayName}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {agent.id}
          </Badge>
        </div>
        <span className="truncate font-mono text-muted-foreground text-xs">
          {agent.command}
        </span>
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${agent.displayName}`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <PencilIcon data-icon="inline-start" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onRemove}>
                <Trash2Icon data-icon="inline-start" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DialogContent className="max-w-lg">
          <CustomAgentForm
            isEditing
            initial={{
              id: agent.id,
              displayName: agent.displayName,
              command: agent.command,
            }}
            onSubmit={(draft) => {
              onUpdate(draft)
              setEditOpen(false)
            }}
            isPending={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AgentSection({
  title,
  description,
  rows,
}: {
  title: string
  description?: string
  rows: AgentDetection[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {title}
        </div>
        {description && (
          <div className="mt-0.5 text-muted-foreground text-xs">
            {description}
          </div>
        )}
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
        {rows.map((row) => (
          <AgentRow key={row.agentId} row={row} />
        ))}
      </div>
    </div>
  )
}

function AgentRow({ row }: { row: AgentDetection }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">
            {row.displayName}
          </span>
          {row.npxBased && row.installState === 'installed' && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              npx
            </Badge>
          )}
        </div>
        {row.version ? (
          <span className="font-mono text-muted-foreground text-xs">
            {row.version}
          </span>
        ) : row.installState === 'npx-available' ? (
          <span className="text-muted-foreground text-xs">
            fetches on first use
          </span>
        ) : null}
      </div>
      {row.installState === 'not-installed' ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // biome-ignore lint/suspicious/noConsole: surface failed openExternal calls; no toast wired yet
            void openExternal(row.installUrl).catch(console.error)
          }}
        >
          Install
          <ExternalLinkIcon data-icon="inline-end" />
        </Button>
      ) : null}
    </div>
  )
}
