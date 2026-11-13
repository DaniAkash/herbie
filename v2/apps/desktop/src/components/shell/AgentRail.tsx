import { AnimateIcon } from '@animate-ui/react/icons'
import { Link, useParams } from '@tanstack/react-router'
import { Plug } from 'lucide-react'
import { AgentFace } from '@/components/agent/AgentFace'
import { Plus } from '@/components/animate-ui/icons/plus'
import { Search } from '@/components/animate-ui/icons/search'
import { Settings } from '@/components/animate-ui/icons/settings'
import { AgentStateDot } from '@/components/shell/AgentStateDot'
import { cn } from '@/lib/utils'
import type { Agent } from '@/modules/api/agents.hooks'
import { openOverlay } from '@/modules/navigation/overlay'

/**
 * The rail, and the only navigation the app has.
 *
 * The conversation list doubles as the inbox: a routine's output arrives as a
 * message from the agent that produced it, so unread belongs here rather than
 * in a screen of its own.
 */
export function AgentRail({ agents }: { agents: readonly Agent[] }) {
  const params = useParams({ strict: false }) as { agentId?: string }
  const active = params.agentId

  return (
    <aside className="grid min-h-0 grid-rows-[auto_auto_auto_1fr_auto] bg-canvas">
      <div className="flex items-center gap-2 px-3.5 pt-1 pb-3">
        <AgentFace color="ops" size="sm" className="text-accent" />
        <span className="font-semibold text-[15px] tracking-[-0.03em]">
          Herbie
        </span>
        <span className="flex-1" />
        <RailIcon to="search" label="Search">
          <Search size={16} />
        </RailIcon>
        <RailIcon to="new" label="New agent">
          <Plus size={16} />
        </RailIcon>
      </div>

      <div className="grid grid-cols-3 gap-0.5 px-[7px] pb-3">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            to="/agents/$agentId"
            params={{ agentId: agent.id }}
            aria-current={agent.id === active ? 'true' : undefined}
            className={cn(
              'grid justify-items-center gap-1.5 rounded-card px-0.5 pt-2 pb-[7px]',
              'transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]',
              'hover:bg-hover aria-[current]:bg-hover-2',
            )}
          >
            <AgentFace
              color={agent.color}
              working={agent.state === 'working'}
              off={agent.state === 'off'}
            />
            <span
              className={cn(
                'max-w-full truncate text-center font-medium text-[11.5px]',
                agent.id === active ? 'text-ink' : 'text-ink-3',
              )}
            >
              {agent.name}
            </span>
          </Link>
        ))}
      </div>

      <div />

      <div className="quiet-scroll min-h-0 overflow-y-auto px-[7px] pb-2.5">
        <div className="px-2 pt-1.5 pb-1.5 font-medium text-[11.5px] text-ink-3">
          Conversations
        </div>
        {agents.map((agent) => (
          <Link
            key={agent.id}
            to="/agents/$agentId"
            params={{ agentId: agent.id }}
            aria-current={agent.id === active ? 'true' : undefined}
            className={cn(
              'grid w-full grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-control p-2 text-left',
              'transition-colors duration-150 ease-out hover:bg-hover aria-[current]:bg-hover-2',
            )}
          >
            <AgentFace
              color={agent.color}
              size="sm"
              off={agent.state === 'off'}
            />
            <span className="min-w-0">
              <span className="block font-medium text-[13.5px] leading-tight">
                {agent.name}
              </span>
              <span className="block truncate text-[12.5px] text-ink-2 leading-tight">
                {agent.activity ?? agent.brief}
              </span>
            </span>
            <AgentStateDot state={agent.state} />
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 px-2.5 pt-[7px] pb-2.5">
        <div className="size-[23px] shrink-0 rounded-full bg-hover-2" />
        <span className="font-medium text-[13.5px]">Dani</span>
        <span className="flex-1" />
        <RailIcon to="tools" label="Tools">
          <Plug size={16} />
        </RailIcon>
        <RailIcon to="herbie" label="Herbie settings">
          <Settings size={16} />
        </RailIcon>
      </div>
    </aside>
  )
}

function RailIcon({
  to,
  label,
  children,
}: {
  to: Parameters<typeof openOverlay>[0]
  label: string
  children: React.ReactNode
}) {
  return (
    <AnimateIcon animateOnHover asChild>
      <Link
        to="."
        search={openOverlay(to)}
        aria-label={label}
        className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 transition-[background-color,color,transform] duration-150 ease-out hover:bg-hover hover:text-ink active:scale-[0.96]"
      >
        {children}
      </Link>
    </AnimateIcon>
  )
}
