import type { TranscriptRecord } from '@bun/shared/transcript'
import {
  MessageBubble,
  MessageBubbleContent,
  MessageSideContext,
} from '@/components/agent/MessageBubble'
import { cn } from '@/lib/utils'
import { Ask } from '@/screens/conversation/blocks/Ask'
import { Code } from '@/screens/conversation/blocks/Code'
import { Context } from '@/screens/conversation/blocks/Context'
import { Explain } from '@/screens/conversation/blocks/Explain'
import { Insight } from '@/screens/conversation/blocks/Insight'
import { MessageMetadata } from '@/screens/conversation/blocks/MessageMetadata'
import { Permission } from '@/screens/conversation/blocks/Permission'
import { Recommendation } from '@/screens/conversation/blocks/Recommendation'
import { Say } from '@/screens/conversation/blocks/Say'
import { Tasks } from '@/screens/conversation/blocks/Tasks'
import { Work } from '@/screens/conversation/blocks/Work'
import type { ThreadState } from '@/screens/conversation/conversation.reducer'

/**
 * One record, as the component the agent chose by calling a tool.
 *
 * The switch is exhaustive over the renderable kinds. The lifecycle records
 * never reach it: the reducer keeps them out of `records` because they move
 * the indicator rather than adding to the thread.
 */
export interface BlockProps {
  readonly record: TranscriptRecord
  readonly thread: ThreadState
  readonly agentName: string
  readonly onAnswer: (
    recordId: string,
    answers: Record<string, number[]>,
  ) => void
  readonly onDecide: (
    recordId: string,
    requestId: string,
    optionId: string,
  ) => void
}

export function Block(props: BlockProps) {
  const content = renderBlock(props)
  if (!content) return null
  return (
    <section
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Messages need focus to reveal timestamps without a mouse.
      tabIndex={0}
      className="group rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      aria-label={
        props.record.kind === 'user' ? 'Your message' : 'Agent response'
      }
    >
      {content}
      <MessageMetadata
        at={props.record.at}
        startedAt={
          props.record.kind === 'user'
            ? undefined
            : props.thread.turnStarts[props.record.turn]
        }
        mine={props.record.kind === 'user'}
      />
    </section>
  )
}

function renderBlock({
  record,
  thread,
  agentName,
  onAnswer,
  onDecide,
}: BlockProps) {
  switch (record.kind) {
    case 'user':
      return <Bubble who="You" mine record={record} />

    case 'error':
      return <Bubble who={agentName} variant="danger" record={record} />

    case 'say':
      return <Say record={record} />
    case 'explain':
      return <Explain record={record} />
    case 'show_work':
      return <Work record={record} />
    case 'show_tasks':
      return <Tasks record={record} />
    case 'show_code':
      return <Code record={record} />
    case 'recommend':
      return <Recommendation record={record} />
    case 'show_context':
      return <Context record={record} />
    case 'show_insight':
      return <Insight record={record} />

    case 'ask':
      return (
        <Ask
          record={record}
          answered={thread.answers[record.id]}
          waiting={thread.pending.includes(record.id)}
          onAnswer={(answers) => onAnswer(record.id, answers)}
        />
      )

    case 'permission':
      return (
        <Permission
          record={record}
          decided={thread.decisions[record.id]}
          waiting={thread.pending.includes(record.id)}
          onDecide={(optionId) =>
            onDecide(record.id, record.requestId, optionId)
          }
        />
      )

    // The reducer does not put these in `records`, so this branch is how the
    // compiler proves it: adding a kind without deciding where it renders is
    // a build failure rather than a block nobody sees.
    case 'turn.start':
    case 'turn.end':
    case 'activity':
    case 'answer':
    case 'decision':
      return null

    default:
      return never(record)
  }
}

function never(_unreachable: never): null {
  return null
}

function Bubble({
  who,
  record,
  mine = false,
  variant = 'soft',
}: {
  who: string
  record: Extract<TranscriptRecord, { kind: 'user' | 'error' }>
  mine?: boolean
  variant?: 'soft' | 'tint' | 'danger'
}) {
  return (
    <MessageSideContext.Provider value={mine ? 'end' : 'start'}>
      <div className="grid gap-1.5">
        <div className={cn('text-[12px] text-ink-3', mine && 'text-right')}>
          {who}
        </div>
        <MessageBubble variant={mine ? 'tint' : variant}>
          <MessageBubbleContent
            className={cn(
              'max-w-[560px]',
              mine && 'dark:text-[#28241f] dark:[--muted:#f3f0e9]',
            )}
          >
            {record.text}
          </MessageBubbleContent>
        </MessageBubble>
      </div>
    </MessageSideContext.Provider>
  )
}
