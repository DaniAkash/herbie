import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { conversations } from './conversations.sql'

// PK `(conversation_id, seq)` doubles as the index for the only query
// shape we issue (`WHERE conversation_id = ? AND seq > ? ORDER BY seq`)
// — sqlite_autoindex_chat_events_1 covers it. No secondary index needed.
export const chatEvents = sqliteTable(
  'chat_events',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    payload: text('payload').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.seq] })],
)

export type ChatEvent = typeof chatEvents.$inferSelect
