import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const TELEGRAM_CONNECTION_STATUSES = [
  'active',
  'paused',
  'error',
] as const
export type TelegramConnectionStatus =
  (typeof TELEGRAM_CONNECTION_STATUSES)[number]

// One row per bot the user has added. The tuple (agentId, modelId,
// workspacePath, reasoningEffort) is pinned at creation and never
// edited — see the Mobile settings tab. botToken is stored encrypted
// via src/bun/security/secrets.ts; lastError is the most recent
// runtime error string so the settings card can surface it.
export const telegramConnections = sqliteTable('telegram_connections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  botUsername: text('bot_username'),
  botTokenEncrypted: text('bot_token_encrypted').notNull(),
  agentId: text('agent_id').notNull(),
  modelId: text('model_id'),
  workspacePath: text('workspace_path').notNull(),
  reasoningEffort: text('reasoning_effort'),
  status: text('status', { enum: TELEGRAM_CONNECTION_STATUSES })
    .notNull()
    .default('active'),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type TelegramConnection = typeof telegramConnections.$inferSelect
