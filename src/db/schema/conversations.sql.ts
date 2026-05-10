import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const CONVERSATION_STATUSES = [
  'idle',
  'streaming',
  'error',
  'cancelled',
] as const
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  agentId: text('agent_id').notNull(),
  acpxSessionId: text('acpx_session_id'),
  acpxRecordId: text('acpx_record_id'),
  agentSessionId: text('agent_session_id'),
  status: text('status', { enum: CONVERSATION_STATUSES })
    .notNull()
    .default('idle'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type Conversation = typeof conversations.$inferSelect
