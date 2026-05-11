import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { taskRuns } from './task-runs.sql'
import { tasks } from './tasks.sql'

export const INBOX_STATUSES = ['unread', 'read', 'done'] as const
export type InboxStatus = (typeof INBOX_STATUSES)[number]

// Inbox is the user-facing surface for scheduled runs (test runs
// never land here). Lifecycle independent of task_runs so
// read/done/star flips don't touch the run record. Snapshots
// taskName + prompt so a later edit (rename, prompt rewrite) on the
// source task doesn't retroactively change the card the user already
// saw. Deletes still cascade — both FKs below are `onDelete:
// 'cascade'`, so removing the task removes its cards too; the
// snapshot is for UPDATEs, not DELETEs.
export const inboxItems = sqliteTable('inbox_items', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  taskName: text('task_name').notNull(),
  taskRunId: text('task_run_id')
    .notNull()
    .references(() => taskRuns.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  agentId: text('agent_id').notNull(),
  modelId: text('model_id'),
  workspacePath: text('workspace_path'),
  reasoningEffort: text('reasoning_effort'),
  // Snapshot of the prompt so "Open in chat" can seed the new
  // conversation without joining back to the (potentially edited)
  // task row.
  promptSnapshot: text('prompt_snapshot').notNull(),
  status: text('status', { enum: INBOX_STATUSES }).notNull().default('unread'),
  starred: integer('starred', { mode: 'boolean' }).notNull().default(false),
  // If the source run failed, the card lands with errorMessage set
  // and body empty — same rich error block as chat.
  errorMessage: text('error_message'),
  errorCode: text('error_code'),
  errorDetails: text('error_details'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export type InboxItem = typeof inboxItems.$inferSelect
