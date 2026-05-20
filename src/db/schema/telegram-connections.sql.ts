import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { conversations } from './conversations.sql'

export const TELEGRAM_CONNECTION_STATUSES = [
  'active',
  'paused',
  'error',
] as const
export type TelegramConnectionStatus =
  (typeof TELEGRAM_CONNECTION_STATUSES)[number]

export const TELEGRAM_CONNECTION_KINDS = [
  'remote_control',
  'special_purpose',
] as const
export type TelegramConnectionKind =
  (typeof TELEGRAM_CONNECTION_KINDS)[number]

// One row per bot the user has added. The tuple (agentId, modelId,
// workspacePath, reasoningEffort) is pinned at creation and never
// edited — see the Mobile settings tab. botToken is stored encrypted
// via src/bun/security/secrets.ts; lastError is the most recent
// runtime error string so the settings card can surface it.
//
// kind discriminates two bot personalities:
//   - 'remote_control': manages a pool of conversations from one bot.
//     Has the full slash-command interface (/new, /list, /switch,
//     /archive). Active conversation per Telegram chat tracked in
//     telegram_active_chat. At most one allowed per user — enforced at
//     the API layer.
//   - 'special_purpose': dedicated to a single conversation pointed
//     to by defaultConversationId. No command interface beyond /help.
//     Many allowed.
//
// defaultConversationId is the routing target for special_purpose
// bots. NULL for remote_control. ON DELETE SET NULL so a deleted
// conversation leaves the bot in an unassigned state — next inbound
// message replies with a "this bot isn't linked" notice rather than
// silently dropping.
export const telegramConnections = sqliteTable('telegram_connections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  botUsername: text('bot_username'),
  botTokenEncrypted: text('bot_token_encrypted').notNull(),
  kind: text('kind', { enum: TELEGRAM_CONNECTION_KINDS })
    .notNull()
    .default('special_purpose'),
  defaultConversationId: text('default_conversation_id').references(
    () => conversations.id,
    { onDelete: 'set null' },
  ),
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
