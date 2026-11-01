import { Link, useParams } from '@tanstack/react-router'
import { PanelRight, Paperclip, Repeat } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { AgentFace } from '@/components/agent/AgentFace'
import { Button } from '@/components/atoms/Button'
import { AgentStateDot } from '@/components/shell/AgentStateDot'
import { cn } from '@/lib/utils'
import type { Agent, Message } from '@/modules/api/agents.hooks'
import { useMessages } from '@/modules/api/agents.hooks'

/**
 * The middle column, and the only place you can be.
 *
 * A routine's output arrives here as a message from the agent, which is why
 * there is no inbox anywhere in the app.
 */
export function Conversation({ agent }: { agent: Agent }) {
  const { agentId } = useParams({ from: '/_shell/agents/$agentId' })
  const { data, isPending, isError } = useMessages({ variables: { agentId } })
  const thread = useRef<HTMLDivElement>(null)

  // A conversation opens on its latest turn. The ref is an imperative scroll
  // on a DOM node, which has no render-time equivalent.
  useEffect(() => {
    const el = thread.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  return (
    <section className="grid min-h-0 min-w-0 grid-rows-[auto_1fr_auto] bg-page">
      <div className="flex items-center gap-2.5 px-[22px] py-2.5">
        <AgentFace color={agent.color} size="sm" />
        <span className="font-semibold text-[15px]">{agent.name}</span>
        {agent.state === 'working' || agent.state === 'stuck' ? (
          <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <AgentStateDot state={agent.state} />
            {agent.state}
          </span>
        ) : null}
        <span className="flex-1" />
        <Link
          to="/agents/$agentId/overview"
          params={{ agentId }}
          aria-label="Agent settings"
          className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink"
        >
          <PanelRight size={16} />
        </Link>
      </div>

      <div
        ref={thread}
        className="grid min-h-0 content-start gap-[18px] overflow-y-auto px-[22px] pt-3 pb-2"
      >
        {isPending ? <ThreadSkeleton /> : null}
        {isError ? (
          <p className="text-red">The sidecar did not answer. Is it running?</p>
        ) : null}
        {data?.messages.length === 0 ? (
          <p className="text-ink-3">
            Nothing yet. Say something, or wait for a routine to fire.
          </p>
        ) : null}
        {data?.messages.map((message) => (
          <Turn key={message.id} message={message} agent={agent} />
        ))}
      </div>

      <div className="px-[22px] pt-2.5 pb-[18px]">
        <div className="grid gap-2.5 rounded-card bg-surface px-3.5 py-3 shadow-hairline">
          <textarea
            rows={1}
            placeholder={`Message ${agent.name}`}
            className="max-h-[120px] min-h-6 w-full resize-none border-none bg-transparent text-[14.5px] leading-normal outline-none placeholder:text-ink-3"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Attach"
              className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink"
            >
              <Paperclip size={16} />
            </button>
            <Button size="xs" variant="quiet">
              <Repeat size={14} />
              Teach a routine
            </Button>
            <span className="flex-1" />
            <Button size="xs">
              {agent.state === 'working' ? 'Stop' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Turn({ message, agent }: { message: Message; agent: Agent }) {
  if (message.role === 'divider') {
    return (
      <div className="flex items-center gap-2.5 text-[12px] text-ink-3 before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        {message.body}
      </div>
    )
  }
  if (message.role === 'tool') {
    return (
      <div className="flex items-center gap-2 text-[13px] text-ink-2">
        {message.body}
      </div>
    )
  }
  const mine = message.role === 'user'
  return (
    <div
      className={cn('grid max-w-[540px] gap-1.5', mine && 'justify-self-end')}
    >
      <div className={cn('text-[12px] text-ink-3', mine && 'text-right')}>
        {mine ? 'You' : agent.name}
      </div>
      <div
        className={cn(
          'rounded-card px-3.5 py-3',
          mine ? 'bg-field' : 'bg-surface shadow-hairline',
        )}
      >
        {message.body}
      </div>
    </div>
  )
}

function ThreadSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <div className="h-16 w-[70%] rounded-card bg-hover" />
      <div className="h-10 w-[45%] justify-self-end rounded-card bg-hover" />
      <div className="h-20 w-[65%] rounded-card bg-hover" />
    </div>
  )
}
