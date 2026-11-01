import { Link, useParams } from '@tanstack/react-router'
import { PanelRight, Repeat } from 'lucide-react'
import { AgentFace } from '@/components/agent/AgentFace'
import {
  MessageBubble,
  MessageBubbleContent,
} from '@/components/agents/message-bubble'
import { MessageSideContext } from '@/components/agents/message-context'
import { MessageScroller } from '@/components/agents/message-scroller'
import { PromptInput } from '@/components/agents/prompt-input'
import ApprovalCard from '@/components/primitives/ApprovalCard'
import ThinkingState from '@/components/primitives/ThinkingState'
import ToolChips from '@/components/primitives/ToolChips'
import { AgentStateDot } from '@/components/shell/AgentStateDot'
import type { Agent, Message } from '@/modules/api/agents.hooks'
import { useMessages } from '@/modules/api/agents.hooks'

/** The runtimes an agent can be bound to, named the way the panel names them. */
const RUNTIME: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini',
}

/**
 * The middle column, and the only place you can be.
 *
 * A routine's output arrives here as a message from the agent, which is why
 * there is no inbox. The viewport is beui's MessageScroller rather than a
 * scroll effect of our own, because it already follows a streamed reply at
 * the live edge and lets go when the reader scrolls up.
 */
export function Conversation({ agent }: { agent: Agent }) {
  const { agentId } = useParams({ from: '/_shell/agents/$agentId' })
  const { data, isPending, isError } = useMessages({ variables: { agentId } })

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

      <MessageScroller
        label={`Conversation with ${agent.name}`}
        busy={agent.state === 'working'}
        className="min-h-0"
        viewportClassName="px-[22px] pt-3 pb-2"
        contentClassName="grid content-start gap-[18px]"
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
      </MessageScroller>

      <div className="px-[22px] pt-2.5 pb-[18px]">
        {/*
          beui rather than beautifui's PromptBar: that one hardcodes its model
          list at module scope, so it would ship invented model names with no
          prop to correct them. This takes the agent's real runtime, and the
          send and stop states the working indicator needs.
        */}
        <PromptInput
          placeholder={`Message ${agent.name}`}
          models={[
            {
              value: agent.acpAgent,
              label: RUNTIME[agent.acpAgent] ?? agent.acpAgent,
            },
          ]}
          model={agent.acpAgent}
          actions={[
            {
              value: 'teach',
              label: 'Teach a routine',
              description: 'Turn this into work it starts by itself',
              icon: <Repeat size={15} />,
            },
          ]}
          loading={agent.state === 'working'}
          minRows={1}
          maxRows={6}
        />
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
      <ToolChips
        // its root hardcodes min-h-[220px] and max-w-80 for the gallery, which
        // leaves a dead gap under a single tool line
        className="!min-h-0 !max-w-[540px]"
        labels={{ header: '1 tool call', more: '' }}
        steps={[
          {
            icon: 'browser',
            label: message.body,
            chip: 'done',
            mono: false,
            detailMono: false,
            detail: [],
          },
        ]}
        diffs={[]}
        diffLines={{}}
      />
    )
  }

  if (message.role === 'question') {
    // beautifui's own surface for "ask before acting", which is what an
    // always-ask rule produces when it fires.
    return (
      <ApprovalCard
        resettable={false}
        labels={{ send: 'Answer', sentMessage: `Sent to ${agent.name}` }}
        questions={[
          {
            q: message.body,
            type: 'radio',
            options: ['Post it now', 'Hold it', 'Show me the text first'],
          },
        ]}
      />
    )
  }

  if (message.role === 'thinking') {
    // rows must be passed or it falls back to its gallery trace about
    // flavour briefs and supplier lists.
    return (
      <ThinkingState
        active={message.body}
        done={message.body}
        rows={[
          { primary: 'Read the feed', secondary: '41 posts' },
          { primary: 'Ranked by engagement' },
          { primary: 'Drafting', secondary: '5 candidates' },
        ]}
      />
    )
  }

  if (message.role === 'error') {
    return (
      <MessageSideContext.Provider value="start">
        <div className="grid gap-1.5">
          <div className="text-[12px] text-ink-3">{agent.name}</div>
          <MessageBubble variant="danger">
            <MessageBubbleContent className="max-w-[540px]">
              {message.body}
            </MessageBubbleContent>
          </MessageBubble>
        </div>
      </MessageSideContext.Provider>
    )
  }

  const mine = message.role === 'user'
  return (
    <MessageSideContext.Provider value={mine ? 'end' : 'start'}>
      <div className="grid gap-1.5">
        <div
          className={
            mine
              ? 'text-right text-[12px] text-ink-3'
              : 'text-[12px] text-ink-3'
          }
        >
          {mine ? 'You' : agent.name}
        </div>
        <MessageBubble variant={mine ? 'tint' : 'soft'}>
          <MessageBubbleContent className="max-w-[540px]">
            {message.body}
          </MessageBubbleContent>
        </MessageBubble>
      </div>
    </MessageSideContext.Provider>
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
