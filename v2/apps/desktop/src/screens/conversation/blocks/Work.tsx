import type { TranscriptRecord } from '@bun/shared/transcript'
import { ToolChips } from '@/screens/conversation/blocks/ToolChips'

type Work = Extract<TranscriptRecord, { kind: 'show_work' }>

/** A `show_work` block: what the agent did, after it did it. */
export function Work({ record }: { record: Work }) {
  const steps = record.steps.length
  return (
    <ToolChips
      className="max-w-[560px]"
      header={steps === 1 ? '1 step' : `${steps} steps`}
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
