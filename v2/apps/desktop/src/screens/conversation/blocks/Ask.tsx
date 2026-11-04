import type { TranscriptRecord } from '@bun/shared/transcript'
import ApprovalCard from '@/components/primitives/ApprovalCard'

type Ask = Extract<TranscriptRecord, { kind: 'ask' }>

/**
 * An `ask` block, which is the one block the agent is stopped on.
 *
 * `resettable` is off: the agent is waiting on this answer and has already
 * been given it, so a reset affordance would offer to change something that
 * has gone. When the answers are in, the card renders them read-only rather
 * than disappearing, because the question and its answer are both part of
 * the thread.
 */
export function Ask({
  record,
  answered,
  waiting,
  onAnswer,
}: {
  record: Ask
  answered: Record<string, readonly number[]> | undefined
  waiting: boolean
  onAnswer: (answers: Record<string, number[]>) => void
}) {
  if (answered || !waiting) {
    return <Answered record={record} answered={answered} />
  }
  return (
    <ApprovalCard
      resettable={false}
      questions={record.questions.map((question) => ({
        q: question.q,
        type: question.type,
        options: [...question.options],
      }))}
      labels={{ send: 'Answer', sentMessage: 'Answer sent' }}
      onSubmitted={(answers) => {
        // The card keys by question index as a number; the route and the
        // thread key by its string, because a skipped question has no entry
        // at all and an array would need a hole in it.
        onAnswer(
          Object.fromEntries(
            Object.entries(answers).map(([at, picked]) => [at, picked]),
          ),
        )
      }}
    />
  )
}

/**
 * The question and what was answered, after the fact.
 *
 * Also what a question from before a restart looks like: nothing is waiting
 * on it any more, so offering to answer it would be offering to reply to an
 * agent that stopped listening.
 */
function Answered({
  record,
  answered,
}: {
  record: Ask
  answered: Record<string, readonly number[]> | undefined
}) {
  return (
    <div className="grid max-w-[560px] gap-2 rounded-card bg-surface p-3 shadow-card">
      {record.questions.map((question, at) => {
        const picked = answered?.[String(at)] ?? []
        return (
          <div key={question.q} className="grid gap-1">
            <span className="text-[13px] text-ink">{question.q}</span>
            <span className="text-[12.5px] text-ink-2">
              {picked.length > 0
                ? picked
                    .map((index) => question.options[index] ?? '')
                    .filter(Boolean)
                    .join(', ')
                : 'No longer waiting on an answer.'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
