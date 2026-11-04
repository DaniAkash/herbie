import type { TranscriptRecord } from '@bun/shared/transcript'
import ToolChips from '@/components/primitives/ToolChips'

type Work = Extract<TranscriptRecord, { kind: 'show_work' }>

/**
 * A `show_work` block: what the agent did, after it did it.
 *
 * The height and width overrides are the component's gallery measurements
 * leaking: its root fixes a 220px minimum and an 80 character measure for a
 * showcase of several steps, which leaves a dead gap under a two-line list.
 */
export function Work({ record }: { record: Work }) {
  const steps = record.steps.length
  return (
    <ToolChips
      className="!min-h-0 !max-w-[560px]"
      labels={{
        header: steps === 1 ? '1 step' : `${steps} steps`,
        more: '',
      }}
      steps={record.steps.map((step) => ({
        icon: step.icon,
        label: step.label,
        chip: step.chip,
        mono: step.mono ?? false,
        detailMono: step.mono ?? false,
        detail: [...(step.detail ?? [])],
      }))}
      diffs={[...(record.diffs ?? [])]}
      diffLines={{}}
    />
  )
}
