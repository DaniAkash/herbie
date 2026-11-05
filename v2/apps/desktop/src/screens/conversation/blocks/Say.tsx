import type { TranscriptRecord } from '@bun/shared/transcript'
import {
  MessageBubble,
  MessageBubbleContent,
} from '@/components/agents/message-bubble'
import { MessageSideContext } from '@/components/agents/message-context'
import { MessageMetadata } from '@/screens/conversation/blocks/MessageMetadata'

export type Said = Extract<TranscriptRecord, { kind: 'say' }>

/**
 * A `say` block: plain text, shown whole.
 *
 * The plain one of the two text surfaces. A greeting or a one-line reply is
 * a chat message, and dressing it in an action row, a sources toggle and a
 * list of questions nobody asked makes it look like a research result.
 *
 * The block also arrives complete, so revealing it a word at a time would be
 * animation pretending to be transport, delaying an answer the app already
 * has. An agent delivering a long answer in parts calls `say` more than once,
 * which is what the tool asks it to do anyway.
 *
 * `explain` is the surface for an answer that earns the chrome.
 */
export function Say({
  record,
  startedAt,
}: {
  record: Said
  startedAt?: number
}) {
  return (
    <MessageSideContext.Provider value="start">
      <div className="group grid gap-1.5">
        <MessageBubble variant="soft">
          <MessageBubbleContent className="max-w-[560px] whitespace-pre-wrap">
            {record.text}
          </MessageBubbleContent>
        </MessageBubble>
        <MessageMetadata at={record.at} startedAt={startedAt} />
        {record.fallback ? <FallbackSeam /> : null}
      </div>
    </MessageSideContext.Provider>
  )
}

/**
 * The visible seam on a promoted block.
 *
 * A turn that reported nothing has its final text promoted into a `say`, and
 * that is marked rather than hidden. If this appears often the reporting
 * contract is not landing, and a silent fallback would look like it worked.
 */
function FallbackSeam() {
  return (
    <span className="text-[11.5px] text-ink-3">
      Said outside the reporting tools, shown here so nothing is lost.
    </span>
  )
}
