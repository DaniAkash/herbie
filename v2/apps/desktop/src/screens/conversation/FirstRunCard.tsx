import { Link } from '@tanstack/react-router'
import { Check, ChevronRight } from 'lucide-react'
import { AgentFace } from '@/components/agent/AgentFace'
import { cn } from '@/lib/utils'
import { type Agent, useRoutines } from '@/modules/api/agents.hooks'
import { useRuntimes } from '@/modules/api/runtimes.hooks'
import { useToolAccess, useTools } from '@/modules/api/tools.hooks'

/**
 * What a new agent still needs, in its own conversation.
 *
 * Every tick is derived from real rows rather than stored, so the card keeps
 * telling the truth after the fact instead of only on the first paint, and
 * nothing needs a column recording that it was dismissed.
 */
export function FirstRunCard({ agent }: { agent: Agent }) {
  const agentId = agent.id
  const routines = useRoutines({ variables: { agentId } })
  const access = useToolAccess({ variables: { agentId } })
  const tools = useTools()
  const { data } = useRuntimes()

  const runtime = data?.runtimes.find((r) => r.id === agent.acpAgent)
  const reaches = access.data?.access.some((a) => a.enabled) ?? false
  const hasRoutine = (routines.data?.routines.length ?? 0) > 0
  const library =
    (tools.data?.servers.length ?? 0) + (tools.data?.skills.length ?? 0)

  return (
    <div className="grid gap-3.5 rounded-card bg-surface p-4 shadow-hairline">
      <div className="flex items-center gap-3">
        <AgentFace color={agent.color} size="lg" />
        <div className="min-w-0">
          <h3 className="font-semibold text-[15px]">{agent.name} is ready</h3>
          <div className="truncate text-[12.5px] text-ink-2">
            {runtime?.displayName ?? agent.acpAgent}
            {agent.model ? ` · ${agent.model}` : ''} ·{' '}
            <span className="font-mono">{agent.workspaceDir}</span>
          </div>
        </div>
      </div>

      <p className="text-ink-2">
        It can read and it can think. It reaches nothing yet, and nothing starts
        it but you.
      </p>

      <div className="grid overflow-hidden rounded-control shadow-hairline [&>*+*]:border-line [&>*+*]:border-t">
        <Todo
          to="permissions"
          agentId={agentId}
          done={reaches}
          k="Let it reach your tools"
          v={
            library === 0
              ? 'Nothing in the library yet'
              : `${library} already set up`
          }
        />
        <Todo
          to="routines"
          agentId={agentId}
          done={hasRoutine}
          k="Give it a routine"
          v="So the work is done before you are up"
        />
        <Todo
          to="overview"
          agentId={agentId}
          done={Boolean(agent.telegramBot)}
          k="Connect its Telegram bot"
          v="So it can reach you when you are out"
        />
      </div>
    </div>
  )
}

function Todo({
  to,
  agentId,
  done,
  k,
  v,
}: {
  to: 'permissions' | 'routines' | 'overview'
  agentId: string
  done: boolean
  k: string
  v: string
}) {
  return (
    <Link
      to={`/agents/$agentId/${to}`}
      params={{ agentId }}
      className="flex items-center gap-2.5 bg-page px-3 py-2.5 text-left hover:bg-hover"
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-[17px] shrink-0 place-items-center rounded-[5px]',
          done
            ? 'bg-accent text-white'
            : 'shadow-[inset_0_0_0_1.5px_var(--line-strong)]',
        )}
      >
        {done ? <Check size={11} strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block font-medium text-[13.5px]',
            done && 'text-ink-3 line-through',
          )}
        >
          {k}
        </span>
        <span className="block truncate text-[12.5px] text-ink-2">{v}</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-ink-3" />
    </Link>
  )
}
