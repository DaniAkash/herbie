import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { conversations } from './conversations.sql'
import { telegramConnections } from './telegram-connections.sql'

// Short-lived tokens for the "Send to Telegram" deep-link handshake.
// The desktop app POSTs to mint a token, embeds it in
//   https://t.me/<botUsername>?start=link_<token>
// then polls. When the user taps the link and hits START in Telegram,
// the bot receives /start link_<token>; the linking handler looks up
// this row, links the Telegram chat to the conversation, deletes the
// token (one-shot), and replies.
//
// 30-minute TTL is enforced in code (expires_at is consulted on
// lookup, and a stale token returns "expired" instead of consuming).
// No background sweeper — rows are tiny and the consume path deletes
// the happy-path ones; expired ones can be GC'd lazily on next mint.
//
// ON DELETE CASCADE on both FKs so a deleted conversation or bot
// invalidates any in-flight token automatically — saves us from
// orphaned tokens pointing at gone rows.
export const pendingTelegramLinks = sqliteTable('pending_telegram_links', {
  token: text('token').primaryKey(),
  connectionId: text('connection_id')
    .notNull()
    .references(() => telegramConnections.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
})

export type PendingTelegramLink = typeof pendingTelegramLinks.$inferSelect
