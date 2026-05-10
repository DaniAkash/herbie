import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import { conversations } from './conversations.sql'

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
  (t) => [
    primaryKey({ columns: [t.conversationId, t.seq] }),
    index('chat_events_conv_seq_idx').on(t.conversationId, t.seq),
  ],
)

export type ChatEvent = typeof chatEvents.$inferSelect
