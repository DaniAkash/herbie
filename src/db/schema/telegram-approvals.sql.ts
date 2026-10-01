import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { conversations } from './conversations.sql'

// A permission request that was offered on Telegram and is waiting for
// a tap.
//
// The button carries only this row's id, because Telegram caps callback
// data at 64 bytes and the conversation and request ids together do not
// reliably fit. Keeping the payload to one short key also means a
// button from an old message cannot be replayed into a different
// conversation.
//
// Rows survive a restart so a card left on the phone can still be
// answered, or at least explained, rather than silently doing nothing.
export const telegramApprovals = sqliteTable(
  'telegram_approvals',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    // The permission request this card decides, not the turn it belongs
    // to: one turn can raise several.
    permissionRequestId: text('permission_request_id').notNull(),
    toolName: text('tool_name').notNull(),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
    outcome: text('outcome'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    convIdx: index('telegram_approvals_conv_idx').on(t.conversationId),
  }),
)

export type TelegramApproval = typeof telegramApprovals.$inferSelect
