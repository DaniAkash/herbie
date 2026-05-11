import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { taskRuns } from './task-runs.sql'

// Mirror of chat_events. PK `(run_id, seq)` covers the only query
// shape (`WHERE run_id = ? AND seq > ? ORDER BY seq`) so no secondary
// index is needed. Events are retained forever per the no-prune
// decision; sidebars can replay deltas if they ever want a per-event
// timeline.
export const taskRunEvents = sqliteTable(
  'task_run_events',
  {
    runId: text('run_id')
      .notNull()
      .references(() => taskRuns.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    payload: text('payload').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.seq] })],
)

export type TaskRunEvent = typeof taskRunEvents.$inferSelect
