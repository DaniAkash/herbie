import { useNavigate, useParams } from '@tanstack/react-router'
import { AgentFace } from '@/components/agent/AgentFace'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import { useAgents } from '@/modules/api/agents.hooks'

const TABS = [
  { to: 'overview', label: 'Overview' },
  { to: 'routines', label: 'Routines' },
  { to: 'permissions', label: 'Permissions' },
] as const

/**
 * The agent slide-over, and the only place an agent is configured.
 *
 * Rendered by each tab route rather than by their parent, so the third grid
 * column is `auto` and collapses to nothing when no tab is open.
 */
export function AgentPanel({
  tab,
  children,
}: {
  tab: (typeof TABS)[number]['to']
  children: React.ReactNode
}) {
  const { agentId } = useParams({ from: '/_shell/agents/$agentId' })
  const navigate = useNavigate()
  const { data } = useAgents()
  const agent = data?.agents.find((a) => a.id === agentId)
  if (!agent) return null

  return (
    <aside className="min-h-0 w-[332px] overflow-y-auto bg-canvas motion-safe:animate-[herbie-slidein_0.26s_cubic-bezier(0.23,1,0.32,1)]">
      <div className="grid place-items-center gap-2 px-4 pt-[18px] pb-3.5 text-center">
        <AgentFace
          color={agent.color}
          size="lg"
          working={agent.state === 'working'}
          off={agent.state === 'off'}
        />
        <div>
          <div className="font-semibold text-[15px]">{agent.name}</div>
          <div className="text-[12.5px] text-ink-2">
            {agent.brief.split('.')[0]}
          </div>
        </div>
        {/* beui Tabs in its pill variant, driven by the route rather than
            by its own state: the open tab is a path, not a selection. */}
        <Tabs
          value={tab}
          variant="pill"
          onValueChange={(next) =>
            navigate({
              to: `/agents/$agentId/${next}`,
              params: { agentId },
            })
          }
        >
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.to} value={t.to}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="px-4 pt-0.5 pb-[22px]">{children}</div>
    </aside>
  )
}
