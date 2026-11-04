import type { TranscriptRecord } from '@bun/shared/transcript'
import TaskRows from '@/components/primitives/TaskRows'

type Tasks = Extract<TranscriptRecord, { kind: 'show_tasks' }>

/**
 * A `show_tasks` block: the state of several pieces of work.
 *
 * Every row is `done` or `running`, never `sequence`. A `sequence` row is
 * driven by the component's own hardcoded tick timeline, which walks it
 * through Failed and then Completed on a clock regardless of what happened,
 * so a real row given that status would animate through states the work
 * never went through. The tool's schema refuses it for the same reason.
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
