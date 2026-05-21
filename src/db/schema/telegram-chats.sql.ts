import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
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
// conversation. For remote_control bots, many rows per (connection,
// telegram chat) are allowed — one per conversation in the pool. The
// old unique index that enforced 1:1 is dropped; the active
// conversation pointer now lives in telegram_active_chat. For
// special_purpose bots, telegram_chats is a "this Telegram chat has
// interacted with this bot" record — routing for these bots uses
// telegram_connections.defaultConversationId, not these rows.
//
// On connection delete the row is dropped (cascade); the conversation
// is left in place but marked archived so the sidebar hides it.
//
// Non-unique index on (connection_id, telegram_chat_id) replaces the
// old unique index that was dropped to enable RC pools. Routing /
// dedupe / tray queries all filter by this pair; without an index
// they'd become table scans as the table grows.
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
    connTgChatIdx: index('telegram_chats_conn_chat_idx').on(
      t.connectionId,
      t.telegramChatId,
    ),
  }),
)

export type TelegramChat = typeof telegramChats.$inferSelect
