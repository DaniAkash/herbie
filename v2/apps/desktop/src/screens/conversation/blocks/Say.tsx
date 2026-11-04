import type { SaySource, TranscriptRecord } from '@bun/shared/transcript'
import StreamingText, {
  type StreamingSource,
} from '@/components/primitives/StreamingText'
import { cn } from '@/lib/utils'

type Said = Extract<TranscriptRecord, { kind: 'say' }>

/**
 * A `say` block, revealed a word at a time.
 *
 * The block arrives whole, so the reveal is presentation rather than
 * transport. It reads as streaming and is far simpler than streaming, and an
 * agent that wants progressive output calls `say` more than once. `loop` is
 * off, which is what the component's own documentation recommends for a real
 * thread: it settles and stays settled.
 *
 * No markdown. The component tokenises on whitespace and renders words, so
 * asterisks would arrive as asterisks. A block that needs structure has a
 * better tool to be reported through.
 */
export function Say({ record }: { record: Said }) {
  const words = record.text.split(/\s+/).filter(Boolean)
  const sources = record.sources ?? []
  const followUps = record.followUps ?? []
  return (
    // The component always draws its sources toggle and its follow-ups
    // heading, even with nothing in either, which on a plain answer reads as
    // "0 sources" above an empty list. It is vendored and reinstalled, so the
    // two are hidden from here rather than patched there.
    <div
      className={cn(
        'grid gap-1.5',
        sources.length === 0 && 'say-no-sources',
        followUps.length === 0 && 'say-no-follow-ups',
      )}
    >
      <StreamingText
        fill
        loop={false}
        content={words.map((text) => ({ text }))}
        sources={sources.map(avatar)}
        followUps={[...followUps]}
        labels={{
          sources: sourceLabel(sources.length),
          followUps: 'You might ask',
        }}
      />
      {record.fallback ? <FallbackSeam /> : null}
    </div>
  )
}

function sourceLabel(count: number): string {
  return count === 1 ? '1 source' : `${count} sources`
}

/**
 * A letter in a coloured square, as the source's avatar.
 *
 * The component wants an image per source and a real one would mean fetching
 * a favicon, which is a desktop app reaching the network to draw a thread it
 * has already received. Derived from the domain so it is at least stable.
 */
function avatar(source: SaySource): StreamingSource {
  const hue =
    [...source.domain].reduce((at, ch) => at + ch.charCodeAt(0), 0) % 360
  const letter = (source.name[0] ?? '?').toUpperCase()
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>` +
    `<rect width='64' height='64' rx='16' fill='hsl(${hue} 52% 42%)'/>` +
    `<text x='32' y='44' font-family='sans-serif' font-size='34' font-weight='600' ` +
    `fill='white' text-anchor='middle'>${letter}</text></svg>`
  return { ...source, image: `data:image/svg+xml,${encodeURIComponent(svg)}` }
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
