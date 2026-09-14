import { eq } from 'drizzle-orm'
import type { DB } from '../../db'
import {
  type TelegramConnection,
  telegramConnections,
} from '../../db/schema/telegram-connections.sql'

/**
 * Facts about a connection that can only be learned from traffic.
 *
 * Neither is knowable at the time the user pastes a token: the DM's
 * chat id only exists once the user has spoken to the bot, and whether
 * the chat has topics turned on is a property of the chat rather than
 * the bot. Both are therefore folded in from inbound messages.
 *
 * Returns the fields that changed so the caller can avoid a write on
 * the overwhelmingly common no-op path.
 */
export function learnedConnectionFields(
  connection: TelegramConnection,
  raw: object,
): Partial<Pick<TelegramConnection, 'dmChatId' | 'topicsEnabled'>> {
  const patch: Partial<Pick<TelegramConnection, 'dmChatId' | 'topicsEnabled'>> =
    {}

  const chatId = privateChatId(raw)
  if (chatId && connection.dmChatId !== chatId) patch.dmChatId = chatId

  if (!connection.topicsEnabled && chatHasTopics(raw)) {
    patch.topicsEnabled = true
  }

  return patch
}

export async function applyLearnedFields(
  db: DB,
  connection: TelegramConnection,
  raw: object,
): Promise<void> {
  const patch = learnedConnectionFields(connection, raw)
  if (Object.keys(patch).length === 0) return
  await db
    .update(telegramConnections)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(telegramConnections.id, connection.id))
    .run()
}

// Only private chats are addressed by this integration, so a group or
// channel id is deliberately not recorded as the DM.
function privateChatId(raw: object): string | null {
  if (!('chat' in raw)) return null
  const chat = raw.chat
  if (typeof chat !== 'object' || chat === null) return null
  if (!('type' in chat) || chat.type !== 'private') return null
  if (!('id' in chat)) return null
  const id = chat.id
  return typeof id === 'number' || typeof id === 'string' ? String(id) : null
}

// Two independent signals, either of which settles it. `has_topics_enabled`
// on the sender is the declarative one from Bot API 9.3; a message that
// actually carries a thread id is the empirical one, and it stays correct
// even if the declarative field moves.
function chatHasTopics(raw: object): boolean {
  if ('message_thread_id' in raw && typeof raw.message_thread_id === 'number') {
    return true
  }
  if (!('from' in raw)) return false
  const from = raw.from
  if (typeof from !== 'object' || from === null) return false
  return 'has_topics_enabled' in from && from.has_topics_enabled === true
}
