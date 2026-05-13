import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { conversations } from './conversations.sql'
import { telegramConnections } from './telegram-connections.sql'

export const TELEGRAM_CHAT_KINDS = [
  'private',
  'group',
  'supergroup',
  'channel',
] as const
export type TelegramChatKind = (typeof TELEGRAM_CHAT_KINDS)[number]

// Maps a Telegram chat (DM / group / channel) to a Herbie
// conversation. One row per (connection, telegram chat) pair. The
// unique index enforces single-conversation-per-chat — supergroup
// "topics" are intentionally collapsed into one conversation per the
// resolved decisions in the plan.
//
// On connection delete the row is dropped (cascade); the conversation
// is left in place but marked archived so the sidebar hides it.
export const telegramChats = sqliteTable(
  'telegram_chats',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => telegramConnections.id, { onDelete: 'cascade' }),
    telegramChatId: text('telegram_chat_id').notNull(),
    chatKind: text('chat_kind', { enum: TELEGRAM_CHAT_KINDS }).notNull(),
    chatTitle: text('chat_title'),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    connTgChat: uniqueIndex('telegram_chats_conn_chat_unique').on(
      t.connectionId,
      t.telegramChatId,
    ),
  }),
)

export type TelegramChat = typeof telegramChats.$inferSelect
