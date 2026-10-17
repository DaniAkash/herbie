import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { conversations } from './conversations.sql'
import { telegramConnections } from './telegram-connections.sql'

export const TELEGRAM_TOPIC_SYNC_STATES = [
  'pending',
  'live',
  'closed',
  'error',
] as const
export type TelegramTopicSyncState = (typeof TELEGRAM_TOPIC_SYNC_STATES)[number]

// One Herbie conversation seen as one Telegram forum topic. The
// conversation id is the primary key because the mapping is 1:1 in
// both directions: a conversation has at most one topic, and a topic
// addresses exactly one conversation.
//
// messageThreadId is null for the General topic, which is where
// messages land in a chat that has topics turned off. That is also the
// fallback row shape for the pre-topics routing path, so a null here
// means "this chat, no specific topic" rather than "unknown".
//
// topicTitle records the title last pushed to Telegram so a rename can
// be diffed without an extra round trip.
export const telegramTopics = sqliteTable(
  'telegram_topics',
  {
    conversationId: text('conversation_id')
      .primaryKey()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    connectionId: text('connection_id')
      .notNull()
      .references(() => telegramConnections.id, { onDelete: 'cascade' }),
    telegramChatId: text('telegram_chat_id').notNull(),
    messageThreadId: integer('message_thread_id'),
    topicTitle: text('topic_title'),
    syncState: text('sync_state', { enum: TELEGRAM_TOPIC_SYNC_STATES })
      .notNull()
      .default('pending'),
    lastError: text('last_error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    // Inbound routing looks a topic up by where the message arrived, so
    // this is the read path for every message. Unique because two
    // conversations sharing a topic would make routing ambiguous.
    threadIdx: uniqueIndex('telegram_topics_thread_unique').on(
      t.connectionId,
      t.telegramChatId,
      t.messageThreadId,
    ),
    connIdx: index('telegram_topics_conn_idx').on(t.connectionId),
  }),
)

export type TelegramTopic = typeof telegramTopics.$inferSelect
