import type { TranscriptRecord } from '@bun/shared/transcript'
import {
  MessageBubble,
  MessageBubbleContent,
} from '@/components/agents/message-bubble'
import { MessageSideContext } from '@/components/agents/message-context'

type Said = Extract<TranscriptRecord, { kind: 'say' }>

/**
 * A `say` block: plain text, shown whole.
 *
 * It was `StreamingText`, which revealed the words one at a time and carried
 * an action row, a sources toggle and a follow-ups list. Three things were
 * wrong with that on a real thread. The block arrives complete, so the reveal
 * was animation pretending to be transport and it delayed an answer the app
 * already had. The chrome dwarfed the content on a short reply. And it made a
 * one-line answer look like a research result.
 *
 * So this is a bubble. An agent that wants to deliver a long answer in parts
 * calls `say` more than once, which is also what the tool asks it to do.
 */
export function Say({ record }: { record: Said }) {
  return (
    <MessageSideContext.Provider value="start">
      <div className="grid gap-1.5">
        <MessageBubble variant="soft">
          <MessageBubbleContent className="max-w-[560px] whitespace-pre-wrap">
            {record.text}
          </MessageBubbleContent>
        </MessageBubble>
        {record.sources && record.sources.length > 0 ? (
          <Sources sources={record.sources} />
        ) : null}
        {record.fallback ? <FallbackSeam /> : null}
      </div>
    </MessageSideContext.Provider>
  )
}

/** Where it came from, when it came from somewhere, as small chips. */
function Sources({ sources }: { sources: NonNullable<Said['sources']> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {sources.map((source) => (
        <a
          key={source.href}
          href={source.href}
          target="_blank"
          rel="noreferrer"
          title={source.name}
          className="inline-flex h-6 items-center rounded-full bg-inset px-2 font-mono text-[11px] text-ink-2 shadow-hairline transition-colors hover:bg-hover hover:text-ink"
        >
          {source.domain}
        </a>
      ))}
    </div>
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
