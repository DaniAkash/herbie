import { Link, useLocation, useParams } from '@tanstack/react-router'
import { PanelRight, Repeat } from 'lucide-react'
import { useState } from 'react'
import { AgentFace } from '@/components/agent/AgentFace'
import { PromptInput } from '@/components/agent/PromptInput'
import { MessageScroller } from '@/components/agents/message-scroller'
import { AgentStateDot } from '@/components/shell/AgentStateDot'
import { cn } from '@/lib/utils'
import type { Agent } from '@/modules/api/agents.hooks'
import { useRuntimes } from '@/modules/api/runtimes.hooks'
import { Block } from '@/screens/conversation/blocks/Block'
import type { Connection } from '@/screens/conversation/conversation.data'
import { useConversation } from '@/screens/conversation/conversation.data'
import type { Phase } from '@/screens/conversation/conversation.reducer'
import { FirstRunCard } from '@/screens/conversation/FirstRunCard'
import { TurnIndicator } from '@/screens/conversation/TurnIndicator'

/**
 * The middle column, and the only place you can be.
 *
 * Every block here is one the agent chose to report. Its ordinary replies are
 * not messages: they move the indicator's label and go to the raw log, and
 * nothing else. That is the whole difference between this and v1, which
 * rendered every part the agent emitted.
 *
 * A routine's output arrives here as blocks from the same runtime, which is
 * why there is no inbox.
 */
export function Conversation({ agent }: { agent: Agent }) {
  const { agentId } = useParams({ from: '/_shell/agents/$agentId' })
  const conversation = useConversation(agentId)
  const { thread, connection } = conversation
  const runtimes = useRuntimes()
  const { pathname } = useLocation()
  const [draft, setDraft] = useState('')

  // Named from what the sidecar found rather than a map in here, so a runtime
  // this file has never heard of still reads as its own name.
  const runtimeName =
    runtimes.data?.runtimes.find((r) => r.id === agent.acpAgent)?.displayName ??
    agent.acpAgent

  // The panel is a route, so whether it is open is a fact about the url
  // rather than state of ours. The button closes it when it is open.
  const panelOpen = /\/(overview|routines|permissions)$/.test(pathname)
  const working = thread.phase !== 'idle'

  return (
    <section className="grid min-h-0 min-w-0 grid-rows-[auto_1fr_auto] bg-page">
      <Header
        agent={agent}
        agentId={agentId}
        panelOpen={panelOpen}
        phase={thread.phase}
      />

      <MessageScroller
        label={`Conversation with ${agent.name}`}
        busy={working}
        className="min-h-0"
        viewportClassName="px-[22px] pt-3 pb-2"
        contentClassName="grid content-start gap-[18px]"
      >
        <ThreadState
          agent={agent}
          connection={connection}
          empty={thread.records.length === 0}
        />

        {thread.records.map((record) => (
          <Block
            key={record.id}
            record={record}
            thread={thread}
            agentName={agent.name}
            onAnswer={conversation.answer}
            onDecide={conversation.decide}
          />
        ))}

        <TurnIndicator
          phase={thread.phase}
          activity={thread.activity}
          startedAt={thread.startedAt}
          steps={thread.steps}
        />
      </MessageScroller>

      <div className="composer-host px-[22px] pt-2.5 pb-[18px]">
        {conversation.sendError ? (
          <p className="pb-1.5 text-[12px] text-red" role="alert">
            {conversation.sendError}
          </p>
        ) : null}
        {/*
          beui rather than beautifui's PromptBar: that one hardcodes its model
          list at module scope, so it would ship invented model names with no
          prop to correct them. This takes the agent's real runtime, and the
          send and stop states the working indicator needs.
        */}
        <PromptInput
          placeholder={`Message ${agent.name}`}
          value={draft}
          onValueChange={setDraft}
          models={[{ value: agent.acpAgent, label: runtimeName }]}
          model={agent.acpAgent}
          actions={[
            {
              value: 'teach',
              label: 'Teach a routine',
              description: 'Turn this into work it starts by itself',
              icon: <Repeat size={15} />,
            },
          ]}
          // A turn in flight turns the send button into a stop button, which
          // is the only way to interrupt an agent that has gone somewhere
          // long. Cancelling also releases anything it was waiting on.
          loading={working || conversation.isSending}
          onStop={conversation.stop}
          onSubmit={(text) => {
            const message = text.trim()
            if (!message) return
            // Cleared only once it has landed. The failure is shown above
            // the composer with the text still in the box, so the person can
            // press send again rather than retype what they lost.
            void conversation.send(message).then((sent) => {
              if (sent) setDraft('')
            })
          }}
          minRows={1}
          maxRows={6}
        />
      </div>
    </section>
  )
}

/** The agent, its state, and the way into its panel. */
function Header({
  agent,
  agentId,
  panelOpen,
  phase,
}: {
  agent: Agent
  agentId: string
  panelOpen: boolean
  phase: Phase
}) {
  const working = phase !== 'idle'
  return (
    <div className="flex items-center gap-2.5 px-[22px] py-2.5">
      <AgentFace color={agent.color} size="sm" />
      <span className="font-semibold text-[15px]">{agent.name}</span>
      {working || agent.state === 'stuck' ? (
        <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
          <AgentStateDot state={working ? 'working' : 'stuck'} />
          {phase === 'waiting' ? 'waiting on you' : agent.state}
        </span>
      ) : null}
      <span className="flex-1" />
      <Link
        to={panelOpen ? '/agents/$agentId' : '/agents/$agentId/overview'}
        params={{ agentId }}
        aria-label={panelOpen ? 'Hide agent settings' : 'Show agent settings'}
        aria-pressed={panelOpen}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-control transition-colors',
          panelOpen
            ? 'bg-hover-2 text-ink'
            : 'text-ink-3 hover:bg-hover hover:text-ink',
        )}
      >
        <PanelRight size={16} />
      </Link>
    </div>
  )
}

/** Whatever stands in for the thread when there is not one yet. */
function ThreadState({
  agent,
  connection,
  empty,
}: {
  agent: Agent
  connection: Connection
  empty: boolean
}) {
  if (connection === 'lost') {
    return (
      <p className="text-[13px] text-red">
        Lost the connection to the sidecar. Trying again.
      </p>
    )
  }
  if (!empty) return null
  return connection === 'open' ? (
    <FirstRunCard agent={agent} />
  ) : (
    <ThreadSkeleton />
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
