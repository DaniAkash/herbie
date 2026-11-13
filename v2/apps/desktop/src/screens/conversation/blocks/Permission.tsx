import type { TranscriptRecord } from '@bun/shared/transcript'
import { ApprovalCard } from '@/screens/conversation/blocks/ApprovalCard'

type Permission = Extract<TranscriptRecord, { kind: 'permission' }>

/**
 * A permission request, as the agent's own options.
 *
 * v1 drew four fixed buttons, Allow, Allow always, Deny, Deny always, which
 * approximated every agent's option set with one guess. These are
 * `request.raw.options` from the agent that asked, so the card offers exactly
 * what it offered and the answer goes back as its own option id.
 */
export function Permission({
  record,
  decided,
  waiting,
  onDecide,
}: {
  record: Permission
  decided: string | null | undefined
  waiting: boolean
  onDecide: (optionId: string) => void
}) {
  if (decided !== undefined || !waiting) {
    return <Settled record={record} decided={decided} />
  }
  return (
    <ApprovalCard
      questions={[
        {
          q: `${record.toolName} needs your say-so.`,
          type: 'radio',
          options: record.options.map((option) => option.name),
        },
      ]}
      labels={{ send: 'Decide', sentMessage: 'Sent' }}
      onSubmitted={(answers) => {
        const picked = answers[0]?.[0] ?? 0
        const option = record.options[picked]
        if (option) onDecide(option.optionId)
      }}
    />
  )
}

function Settled({
  record,
  decided,
}: {
  record: Permission
  decided: string | null | undefined
}) {
  const chosen = record.options.find((option) => option.optionId === decided)
  return (
    <div className="grid max-w-[560px] gap-1 rounded-card bg-surface p-3 shadow-card">
      <span className="text-[13px] text-ink">{record.toolName}</span>
      <span className="text-[12.5px] text-ink-2">
        {chosen
          ? `You chose ${chosen.name}.`
          : 'No longer waiting on a decision.'}
      </span>
    </div>
  )
}
