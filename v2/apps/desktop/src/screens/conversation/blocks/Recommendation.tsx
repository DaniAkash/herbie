import type { RecommendOption, TranscriptRecord } from '@bun/shared/transcript'
import RecommendationCard, {
  type RecommendationOption,
} from '@/components/primitives/RecommendationCard'

export type Recommend = Extract<TranscriptRecord, { kind: 'recommend' }>

/**
 * A `recommend` block: a decision with a default and alternatives.
 *
 * The card draws confidence as a three-bar meter in a colour, which is why
 * the tool asks for one of three words rather than a sentence. Deriving the
 * meter from an option's position in the list would be the card inventing a
 * confidence the agent never stated.
 */
const METER: Record<
  RecommendOption['confidence'],
  { signal: number; tone: string; label: string }
> = {
  strong: { signal: 3, tone: 'var(--green)', label: 'Confident' },
  fair: { signal: 2, tone: 'var(--orange)', label: 'Worth a look' },
  weak: { signal: 1, tone: 'var(--ink-3)', label: 'Thin evidence' },
}

export function Recommendation({ record }: { record: Recommend }) {
  // Recommended first, so the card opens on it: its selection starts at zero
  // and there is no prop to start it anywhere else.
  const ordered = [...record.options].sort(
    (a, b) => Number(b.recommended ?? false) - Number(a.recommended ?? false),
  )

  return (
    <RecommendationCard
      labels={{
        title: record.title,
        alternatives: 'Alternatives',
        otherOptions: 'Other options',
        accepted: 'Chosen',
      }}
      options={ordered.map((option, at): RecommendationOption => {
        const meter = METER[option.confidence]
        return {
          key: `${at}-${option.label}`,
          body: option.detail,
          short: option.label,
          signal: meter.signal,
          tone: meter.tone,
          label: meter.label,
          cta: option.recommended ? 'Do this' : 'Do this instead',
          ctaVariant: option.recommended ? 'accent' : 'primary',
        }
      })}
    />
  )
}
