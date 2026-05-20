import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import { conversations } from './conversations.sql'
import { telegramConnections } from './telegram-connections.sql'

// Active-conversation pointer for remote_control bots. Composite PK on
// (connectionId, telegramChatId) enforces "exactly one active
// conversation per Telegram chat per bot" — switching is a single
// upsert. Special-purpose bots don't use this table at all; their
// routing target lives in telegram_connections.defaultConversationId.
//
// ON DELETE CASCADE on both FKs so the pointer drops automatically
// when its connection is removed or its conversation deleted. After a
// cascade clears the pointer, the next inbound message falls through
// to the fallback chain in resolveConversationId.
export const telegramActiveChat = sqliteTable(
  'telegram_active_chat',
  {
    connectionId: text('connection_id')
      .notNull()
      .references(() => telegramConnections.id, { onDelete: 'cascade' }),
    telegramChatId: text('telegram_chat_id').notNull(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.connectionId, t.telegramChatId] }),
  }),
)

export type TelegramActiveChat = typeof telegramActiveChat.$inferSelect
