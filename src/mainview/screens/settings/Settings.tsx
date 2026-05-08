import { ExternalLinkIcon } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { type AgentDetection, useAgents } from '@/modules/api/agents.hooks'
import {
  useAppSettings,
  useUpdateAppSettings,
} from '@/modules/api/appSettings.hooks'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type { AgentId } from '@/modules/data/herbie-data.types'

const HERBIE_PRIMARY_AGENTS: ReadonlySet<AgentId> = new Set([
  'claude',
  'codex',
  'gemini',
  'hermes',
])

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
              <PlaceholderTab
                title="MCP server registry"
                body="Add an MCP server once, sync into every agent's config. UI scaffolded; sync engine ships with the registry-sync milestone."
              />
            </TabsContent>
            <TabsContent value="skills">
              <PlaceholderTab
                title="Skills"
                body="Drop a skill folder in ~/.herbie/skills. Herbie symlinks it into each agent's skills directory."
              />
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
  const { data, isLoading } = useAppSettings()
  const { mutate } = useUpdateAppSettings()

  if (isLoading || !data) {
    return <Skeleton className="h-40 rounded-lg" />
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-sm">Application</h2>
      <div className="divide-y divide-border rounded-lg border bg-card">
        <SettingRow
          label="Launch at login"
          description="Open Herbie automatically when you log in to your Mac."
          checked={data.launchAtLogin}
          onChange={(v) => mutate({ launchAtLogin: v })}
        />
        <SettingRow
          label="Keep in menu bar on close"
          description="When the window is closed, hide it instead of quitting. Reach Herbie again via the menu bar icon."
          checked={data.minimizeToMenubarOnClose}
          onChange={(v) => mutate({ minimizeToMenubarOnClose: v })}
        />
      </div>
    </section>
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
  const { agents, defaultAgent, setDefaultAgent } = useHerbieData()
  const { data, isLoading } = useAgents()

  const rows = data ?? []
  const primaryRows = rows.filter((row) => isPrimaryAgent(row.agentId))
  const installed = primaryRows.filter((r) => r.installState === 'installed')
  const npxAvailable = primaryRows.filter(
    (r) => r.installState === 'npx-available',
  )
  const notInstalled = rows.filter((r) => r.installState === 'not-installed')

  const installedPrimaryIds = new Set<AgentId>(
    [...installed, ...npxAvailable]
      .map((r) => r.agentId)
      .filter(isPrimaryAgent),
  )
  const pickerAgents = agents.filter((a) => installedPrimaryIds.has(a.id))

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
            {pickerAgents.map((agent) => (
              <ToggleGroupItem
                key={agent.id}
                value={agent.id}
                aria-label={agent.label}
              >
                {agent.label}
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
        <a
          href={row.installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Install
          <ExternalLinkIcon data-icon="inline-end" />
        </a>
      ) : null}
    </div>
  )
}

function PlaceholderTab({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-sm">{title}</h2>
      <div className="rounded-lg border border-dashed bg-card/40 p-10 text-center">
        <p className="mx-auto max-w-md text-muted-foreground text-sm leading-relaxed">
          {body}
        </p>
      </div>
    </section>
  )
}

function MobileTab() {
  const [token, setToken] = useState('')
  const connected = false

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-sm">Telegram</h2>
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <span
            className={cn(
              'size-2 rounded-full',
              connected ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            )}
            aria-hidden
          />
          <span className="font-medium text-sm">
            {connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="tg-token">Bot token</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="tg-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456:ABC-DEF…"
                className="flex-1 font-mono"
              />
              <Button disabled={!token}>Connect</Button>
            </div>
            <FieldDescription>
              Get a bot token from <span className="font-mono">@BotFather</span>{' '}
              on Telegram. Herbie reaches Telegram via outbound polling — no
              public URL required.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </div>
    </section>
  )
}

function AboutTab() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-sm">About</h2>
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-2 font-semibold">Herbie</div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          A lightweight 24×7 menubar AI assistant. Routes prompts to the right
          coding agent, runs scheduled tasks, and bridges to your phone via
          Telegram.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Version</div>
            <div className="font-mono">0.0.1</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Data folder</div>
            <div className="font-mono">~/.herbie</div>
          </div>
        </div>
      </div>
    </section>
  )
}
