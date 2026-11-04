import type { SaySource, TranscriptRecord } from '@bun/shared/transcript'
import StreamingText, {
  type StreamingSource,
} from '@/components/primitives/StreamingText'
import { cn } from '@/lib/utils'

type Explain = Extract<TranscriptRecord, { kind: 'explain' }>

/**
 * An `explain` block: a researched answer, presented as a document.
 *
 * This is the richer of the two text surfaces. It carries the action row,
 * the sources list and the follow-up questions, which is chrome worth having
 * around an answer someone went and found out, and far too much around a
 * greeting. That is why `say` exists beside it as a plain bubble, and why the
 * tool descriptions spend a sentence each on which is which.
 *
 * `loop` is off, which the component's own documentation recommends for a
 * real thread: it settles and stays settled.
 */
export function Explain({ record }: { record: Explain }) {
  const sources = record.sources ?? []
  const followUps = record.followUps ?? []
  const words = record.text.split(/\s+/).filter(Boolean)

  return (
    // The component draws its sources toggle and its follow-ups heading even
    // with nothing in either. It is vendored and reinstalled by `ui:add`, so
    // an empty one is hidden from here rather than patched there.
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
          sources:
            sources.length === 1 ? '1 source' : `${sources.length} sources`,
          followUps: 'You might ask',
        }}
      />
    </div>
  )
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
