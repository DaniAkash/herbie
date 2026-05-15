import { ExternalLinkIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type AgentDetection, useAgents } from '@/modules/api/agents.hooks'
import { useDefaultAgent } from '@/modules/api/settings.hooks'
import { openExternal } from '@/modules/system/openExternal'

export function AgentsTab() {
  const { defaultAgent, setDefaultAgent } = useDefaultAgent()
  const { data, isLoading } = useAgents()

  // Mirror the composer AgentPicker's grouping: anything not in
  // `not-installed` is usable today (the npx-available ones just fetch
  // on first use). The picker's filter is `installState !== 'not-installed'`,
  // so the settings page splits the same way.
  const rows = data ?? []
  const installed = rows.filter((r) => r.installState === 'installed')
  const npxAvailable = rows.filter((r) => r.installState === 'npx-available')
  const notInstalled = rows.filter((r) => r.installState === 'not-installed')

  const pickerRows: AgentDetection[] = [...installed, ...npxAvailable]

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Default agent for new chats</h2>
        {pickerRows.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Install one of the supported agents below to set a default.
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

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Agents</h2>
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
