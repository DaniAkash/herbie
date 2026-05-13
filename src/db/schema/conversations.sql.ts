import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const CONVERSATION_STATUSES = [
  'idle',
  'streaming',
  'error',
  'cancelled',
] as const
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

export const CONVERSATION_ORIGINS = ['chat', 'telegram'] as const
export type ConversationOrigin = (typeof CONVERSATION_ORIGINS)[number]

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  agentId: text('agent_id').notNull(),
  modelId: text('model_id'),
  workspacePath: text('workspace_path'),
  reasoningEffort: text('reasoning_effort'),
  acpxSessionId: text('acpx_session_id'),
  acpxRecordId: text('acpx_record_id'),
  agentSessionId: text('agent_session_id'),
  status: text('status', { enum: CONVERSATION_STATUSES })
    .notNull()
    .default('idle'),
  // Discriminates in-app composer conversations from external-channel
  // ones (Telegram today, more later). The sidebar's dated buckets
  // filter to origin='chat'; external channels render under their own
  // collapsible group.
  origin: text('origin', { enum: CONVERSATION_ORIGINS })
    .notNull()
    .default('chat'),
  // Set when the source external connection is deleted. The
  // conversation row + chat_events stay on disk for future archive
  // browsing, but anything filtering by archivedAt IS NULL hides it
  // from the sidebar.
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  // Bumped to "now" when the renderer opens the conversation. Unread
  // count for sidebar badges is the number of chat_events with
  // createdAt > lastSeenAt. NULL means "never seen" (every event is
  // unread).
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type Conversation = typeof conversations.$inferSelect
