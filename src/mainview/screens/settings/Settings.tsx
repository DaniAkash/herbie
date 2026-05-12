import { ExternalLinkIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { AboutTab, MobileTab } from '@/components/settings/MiscTabs'
import { RegistryTab } from '@/components/settings/RegistryTab'
import { SkillsTab } from '@/components/settings/SkillsTab'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type AgentDetection, useAgents } from '@/modules/api/agents.hooks'
import {
  type ThemeMode,
  useDefaultAgent,
  useSettings,
  useUpdateSettings,
} from '@/modules/api/settings.hooks'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { openExternal } from '@/modules/system/openExternal'

const AGENT_LABELS: Record<AgentId, string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
  gemini: 'Gemini CLI',
  hermes: 'Hermes Agent',
}

const HERBIE_PRIMARY_AGENTS: ReadonlySet<AgentId> = new Set(
  Object.keys(AGENT_LABELS) as AgentId[],
)

function isPrimaryAgent(agentId: string): agentId is AgentId {
  return HERBIE_PRIMARY_AGENTS.has(agentId as AgentId)
}

export function Settings() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader maxWidth="max-w-3xl">
        <h1 className="font-semibold text-base tracking-tight">Settings</h1>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <Tabs defaultValue="general">
            <TabsList variant="line" className="mb-6 gap-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="registry">Registry</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="mobile">Mobile</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <GeneralTab />
            </TabsContent>
            <TabsContent value="agents">
              <AgentsTab />
            </TabsContent>
            <TabsContent value="registry">
              <RegistryTab />
            </TabsContent>
            <TabsContent value="skills">
              <SkillsTab />
            </TabsContent>
            <TabsContent value="mobile">
              <MobileTab />
            </TabsContent>
            <TabsContent value="about">
              <AboutTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

function GeneralTab() {
  const { data, isLoading } = useSettings()
  const { mutate } = useUpdateSettings()

  if (isLoading || !data) {
    return <Skeleton className="h-40 rounded-lg" />
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Appearance</h2>
        <ToggleGroup
          value={[data.appearance.theme]}
          onValueChange={(v: string[]) =>
            v[0] && mutate({ appearance: { theme: v[0] as ThemeMode } })
          }
          variant="outline"
        >
          <ToggleGroupItem value="light" aria-label="Light">
            Light
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" aria-label="Dark">
            Dark
          </ToggleGroupItem>
          <ToggleGroupItem value="system" aria-label="System">
            System
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Application</h2>
        <div className="divide-y divide-border rounded-lg border bg-card">
          <SettingRow
            label="Launch at login"
            description="Open Herbie automatically when you log in to your Mac."
            checked={data.general.launchAtLogin}
            onChange={(v) => mutate({ general: { launchAtLogin: v } })}
          />
          <SettingRow
            label="Keep in menu bar on close"
            description="When the window is closed, hide it instead of quitting. Reach Herbie again via the menu bar icon."
            checked={data.general.minimizeToMenubarOnClose}
            onChange={(v) =>
              mutate({ general: { minimizeToMenubarOnClose: v } })
            }
          />
        </div>
      </section>
    </div>
  )
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function AgentsTab() {
  const { defaultAgent, setDefaultAgent } = useDefaultAgent()
  const { data, isLoading } = useAgents()

  const rows = data ?? []
  const primaryRows = rows.filter((row) => isPrimaryAgent(row.agentId))
  const installed = primaryRows.filter((r) => r.installState === 'installed')
  const npxAvailable = primaryRows.filter(
    (r) => r.installState === 'npx-available',
  )
  const notInstalled = rows.filter((r) => r.installState === 'not-installed')

  const pickerAgents: AgentId[] = [...installed, ...npxAvailable]
    .map((r) => r.agentId)
    .filter(isPrimaryAgent)

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Default agent for new chats</h2>
        {pickerAgents.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Install one of the supported agents below to set a default.
          </p>
        ) : (
          <ToggleGroup
            value={[defaultAgent]}
            onValueChange={(v: string[]) =>
              v[0] && setDefaultAgent(v[0] as AgentId)
            }
            variant="outline"
          >
            {pickerAgents.map((id) => (
              <ToggleGroupItem
                key={id}
                value={id}
                aria-label={AGENT_LABELS[id]}
              >
                {AGENT_LABELS[id]}
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
