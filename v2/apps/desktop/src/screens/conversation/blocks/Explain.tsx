import type { SaySource, TranscriptRecord } from '@bun/shared/transcript'
import {
  type AnswerSource,
  AnswerText,
} from '@/components/primitives/AnswerText'

type Explain = Extract<TranscriptRecord, { kind: 'explain' }>

/**
 * An `explain` block: a researched answer, presented as a document.
 *
 * The richer of the two text surfaces. It carries the copy action, the
 * sources list and the follow-up questions, which is chrome worth having
 * around an answer someone went and found out, and far too much around a
 * greeting. That is why `say` exists beside it as a plain bubble, and why
 * the tool descriptions spend a sentence each on which is which.
 *
 * The text is markdown and is rendered whole, because the agent writes the
 * whole block in one call.
 */
export function Explain({
  record,
  onFollowUp,
  followUpsDisabled,
}: {
  record: Explain
  onFollowUp: (text: string) => void
  followUpsDisabled: boolean
}) {
  const sources = record.sources ?? []

  return (
    <AnswerText
      sources={sources.map(avatar)}
      followUps={record.followUps ?? []}
      onFollowUp={onFollowUp}
      followUpsDisabled={followUpsDisabled}
    >
      {record.text}
    </AnswerText>
  )
}

/**
 * A letter in a coloured square, as the source's avatar.
 *
 * A real favicon would mean a desktop app reaching the network to draw a
 * thread it has already received. Derived from the domain so it is at least
 * stable between renders.
 */
function avatar(source: SaySource): AnswerSource {
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
