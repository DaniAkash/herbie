import type { ContextPassage, TranscriptRecord } from '@bun/shared/transcript'
import ContextCards from '@/components/primitives/ContextCards'

type Context = Extract<TranscriptRecord, { kind: 'show_context' }>

/** A colour per card, cycled, because the component expects one per chunk. */
const TONES = ['bg-green', 'bg-blue', 'bg-orange', 'bg-red'] as const

/**
 * A `show_context` block: the passages the agent read, with their sources.
 *
 * Its props are already plain data, so this is a rename rather than an
 * accommodation. The badge and the character count are derived here instead
 * of being asked of the agent: both are facts about the text it already sent,
 * and a tool argument the caller can get wrong is worse than one it cannot.
 */
export function Context({ record }: { record: Context }) {
  return (
    <ContextCards
      labels={{
        header: record.header,
        count: String(record.chunks.length),
      }}
      chunks={record.chunks.map((chunk, at) => ({
        title: chunk.source,
        chars: `${chunk.text.length.toLocaleString()} characters`,
        body: chunk.text,
        source: label(chunk),
        badge: badge(chunk),
        tone: TONES[at % TONES.length] ?? 'bg-green',
      }))}
    />
  )
}

/** The host of a link, or the source's own name when it is not one. */
function label(chunk: ContextPassage): string {
  if (!chunk.href) return chunk.source
  try {
    return new URL(chunk.href).hostname
  } catch {
    return chunk.href
  }
}

function badge(chunk: ContextPassage): string {
  if (chunk.href?.startsWith('http')) return 'WEB'
  const extension = chunk.source.split('.').pop()
  return extension && extension !== chunk.source
    ? extension.toUpperCase().slice(0, 4)
    : 'TEXT'
}
