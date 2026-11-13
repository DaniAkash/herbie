import type { TranscriptRecord } from '@bun/shared/transcript'
import { TaskRows } from '@/screens/conversation/blocks/TaskRows'

type Tasks = Extract<TranscriptRecord, { kind: 'show_tasks' }>

/**
 * A `show_tasks` block: the state of several pieces of work.
 *
 * Every row is `done` or `running`. The tool's schema offers nothing else, so
 * no row can be made to animate through states the work never went through.
 */
export function Tasks({ record }: { record: Tasks }) {
  return (
    <TaskRows
      className="!max-w-[560px]"
      rows={record.rows.map((row, at) => ({
        key: `${at}-${row.label}`,
        label: row.label,
        amount: row.amount ?? '',
        status: row.status,
        details: [...(row.details ?? [])],
      }))}
    />
  )
}
