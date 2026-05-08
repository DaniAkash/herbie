import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'

export function Settings() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-border border-b bg-background/95 px-6 py-3 backdrop-blur">
        <h1 className="font-semibold text-base">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <Tabs defaultValue="agents">
            <TabsList>
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

function AgentsTab() {
  const { agents, defaultAgent, setDefaultAgent } = useHerbieData()
  return (
    <div className="flex flex-col gap-6">
      <Section title="Installed agents">
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    agent.status === 'ready' && 'bg-emerald-500',
                    agent.status === 'signin-required' && 'bg-amber-500',
                    agent.status === 'not-installed' &&
                      'bg-muted-foreground/40',
                  )}
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
      </Section>
      <Section title="Default agent for new chats">
        <div className="flex flex-wrap gap-2">
          {agents.map((agent) => (
            <Button
              key={agent.id}
              variant={agent.id === defaultAgent ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDefaultAgent(agent.id)}
            >
              {agent.label}
            </Button>
          ))}
        </div>
      </Section>
    </div>
  )
}

function RegistryTab() {
  return (
    <Section title="MCP servers">
      <div className="rounded-lg border border-border border-dashed bg-card/50 p-8 text-center text-muted-foreground text-sm">
        MCP server registry — UI scaffold only in this prototype. Production
        wiring lands with the architecture sub-plan{' '}
        <span className="font-mono">herbie-registry-sync</span>.
      </div>
    </Section>
  )
}

function SkillsTab() {
  return (
    <Section title="Skills">
      <div className="rounded-lg border border-border border-dashed bg-card/50 p-8 text-center text-muted-foreground text-sm">
        Skills registry — drop-folder + symlink mirror to each agent's skills
        directory. UI scaffold only.
      </div>
    </Section>
  )
}

function MobileTab() {
  const [token, setToken] = useState('')
  const connected = false

  return (
    <div className="flex flex-col gap-6">
      <Section title="Telegram">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                connected ? 'bg-emerald-500' : 'bg-muted-foreground/40',
              )}
            />
            <span className="font-medium text-sm">
              {connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <p className="mb-4 text-muted-foreground text-xs">
            Get a bot token from <span className="font-mono">@BotFather</span>{' '}
            on Telegram, paste it here, and click Connect. Herbie reaches
            Telegram via outbound polling — no public URL required.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tg-token">Bot token</Label>
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
          </div>
        </div>
      </Section>
    </div>
  )
}

function AboutTab() {
  return (
    <Section title="About">
      <div className="rounded-lg border border-border bg-card p-5 text-sm">
        <div className="mb-2 font-semibold">Herbie</div>
        <p className="text-muted-foreground text-xs">
          A lightweight 24×7 menubar AI assistant. Routes prompts to the right
          coding agent, runs scheduled tasks, and bridges to your phone via
          Telegram.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Version</div>
            <div className="font-mono">0.0.1</div>
          </div>
          <div>
            <div className="text-muted-foreground">Data folder</div>
            <div className="font-mono">~/.herbie</div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-6 first:mt-4">
      <h2 className="mb-3 font-medium text-sm">{title}</h2>
      {children}
    </section>
  )
}
