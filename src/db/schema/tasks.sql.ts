import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const TASK_STATUSES = ['active', 'paused'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

// ScheduleConfig + outputs ride as JSON because their shape varies and
// JSON keeps the per-task surface inside a single row. Validation
// happens at the Zod layer in the route, not at the column level.
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  prompt: text('prompt').notNull(),
  agentId: text('agent_id').notNull(),
  modelId: text('model_id'),
  workspacePath: text('workspace_path'),
  reasoningEffort: text('reasoning_effort'),
  scheduleJson: text('schedule_json').notNull(),
  status: text('status', { enum: TASK_STATUSES }).notNull().default('active'),
  // Extra delivery channels beyond inbox (inbox is always-on). Keeps
  // the door open for telegram/etc; today it ships as an empty array.
  outputsJson: text('outputs_json').notNull().default('[]'),
  lastRunAt: integer('last_run_at', { mode: 'timestamp_ms' }),
  nextRunAt: integer('next_run_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type Task = typeof tasks.$inferSelect
