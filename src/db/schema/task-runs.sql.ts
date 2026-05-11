import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { tasks } from './tasks.sql'

export const TASK_RUN_STATUSES = [
  'running',
  'completed',
  'cancelled',
  'error',
] as const
export type TaskRunStatus = (typeof TASK_RUN_STATUSES)[number]

export const TASK_RUN_TRIGGERS = ['scheduled', 'test'] as const
export type TaskRunTrigger = (typeof TASK_RUN_TRIGGERS)[number]

// Each run snapshots the tuple + prompt at fire time so a later task
// edit doesn't rewrite history. resultText aggregates assistant text
// at terminal time; the live event stream lives in task_run_events.
export const taskRuns = sqliteTable('task_runs', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  promptSnapshot: text('prompt_snapshot').notNull(),
  agentId: text('agent_id').notNull(),
  modelId: text('model_id'),
  workspacePath: text('workspace_path'),
  reasoningEffort: text('reasoning_effort'),
  trigger: text('trigger', { enum: TASK_RUN_TRIGGERS }).notNull(),
  status: text('status', { enum: TASK_RUN_STATUSES })
    .notNull()
    .default('running'),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  resultText: text('result_text'),
  errorMessage: text('error_message'),
  errorCode: text('error_code'),
  errorDetails: text('error_details'),
})

export type TaskRun = typeof taskRuns.$inferSelect
