import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type { AgentId } from '@/modules/data/herbie-data.types'

export function Settings() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="drag-region flex shrink-0 items-center border-b bg-background/80 px-6 py-3 backdrop-blur">
        <h1 className="font-semibold text-base tracking-tight">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <Tabs defaultValue="agents">
            <TabsList variant="line" className="mb-6 gap-4">
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="registry">Registry</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="mobile">Mobile</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>
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

function AgentsTab() {
  const { agents, defaultAgent, setDefaultAgent } = useHerbieData()
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Installed agents</h2>
        <div className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between gap-4 px-5 py-3.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'size-2 rounded-full',
                    agent.status === 'ready' && 'bg-emerald-500',
                    agent.status === 'signin-required' && 'bg-amber-500',
                    agent.status === 'not-installed' &&
                      'bg-muted-foreground/40',
                  )}
                  aria-hidden
                />
                <div>
                  <div className="font-medium text-sm">{agent.label}</div>
                  <div className="text-muted-foreground text-xs">
                    {agent.status === 'ready' && 'logged in'}
                    {agent.status === 'signin-required' && 'not logged in'}
                    {agent.status === 'not-installed' && 'not installed'}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm">
                {agent.status === 'ready' && 'Sign out'}
                {agent.status === 'signin-required' && 'Sign in'}
                {agent.status === 'not-installed' && 'Install'}
              </Button>
            </div>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Default agent for new chats</h2>
        <ToggleGroup
          value={[defaultAgent]}
          onValueChange={(v: string[]) =>
            v[0] && setDefaultAgent(v[0] as AgentId)
          }
          variant="outline"
        >
          {agents.map((agent) => (
            <ToggleGroupItem
              key={agent.id}
              value={agent.id}
              aria-label={agent.label}
            >
              {agent.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>
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
