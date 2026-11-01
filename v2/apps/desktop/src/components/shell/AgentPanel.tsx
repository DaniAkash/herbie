import { Link, useParams } from '@tanstack/react-router'
import { AgentFace } from '@/components/agent/AgentFace'
import { cn } from '@/lib/utils'
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
        <div className="inline-flex gap-0.5 rounded-full bg-field p-0.5 shadow-hairline">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={`/agents/$agentId/${t.to}`}
              params={{ agentId }}
              className={cn(
                'rounded-full px-3 py-1 font-medium text-[12.5px] transition-colors duration-150 ease-out',
                t.to === tab
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-ink-3 hover:text-ink',
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="px-4 pt-0.5 pb-[22px]">{children}</div>
    </aside>
  )
}
