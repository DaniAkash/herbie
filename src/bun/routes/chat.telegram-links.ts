import { eq, inArray } from 'drizzle-orm'
import { telegramActiveChat } from '../../db/schema/telegram-active-chat.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import {
  type TelegramConnectionKind,
  telegramConnections,
} from '../../db/schema/telegram-connections.sql'
import { getDb } from '../db-singleton'

export interface TelegramLinkInfo {
  connectionId: string
  botUsername: string | null
  botName: string
  kind: TelegramConnectionKind
}

export interface TelegramLinksLookup {
  // Conversation id → its bot. A conversation can be linked to at most
  // one bot (enforced socially by the UI and reassignment flow).
  byConversation: Map<string, TelegramLinkInfo>
  // Conversation ids that are currently the active route from some
  // remote_control bot. Only meaningful for kind='remote_control'.
  activeIds: Set<string>
}

// Resolves Telegram link state for a batch of conversation ids in one
// pass — used by the unified sidebar's GET /chat handler. Three
// queries: special-purpose links via connection.defaultConversationId,
// remote-control links via telegram_chats, and active routes via
// telegram_active_chat. Merged in JS.
export async function loadTelegramLinks(
  conversationIds: string[],
): Promise<TelegramLinksLookup> {
  if (conversationIds.length === 0) {
    return { byConversation: new Map(), activeIds: new Set() }
  }
  const db = getDb()
  const byConversation = new Map<string, TelegramLinkInfo>()

  // Special-purpose: defaultConversationId is the pointer.
  // inArray on a nullable column quietly skips NULL rows — exactly
  // what we want.
  const spRows = await db
    .select({
      conversationId: telegramConnections.defaultConversationId,
      connectionId: telegramConnections.id,
      botUsername: telegramConnections.botUsername,
      botName: telegramConnections.name,
      kind: telegramConnections.kind,
    })
    .from(telegramConnections)
    .where(inArray(telegramConnections.defaultConversationId, conversationIds))
    .all()
  for (const row of spRows) {
    if (!row.conversationId) continue
    byConversation.set(row.conversationId, {
      connectionId: row.connectionId,
      botUsername: row.botUsername,
      botName: row.botName,
      kind: row.kind,
    })
  }

  // Remote-control: telegram_chats rows mapping conversation → bot.
  // SELECT DISTINCT in case a conversation has more than one chat
  // viewport on the same bot (a DM and a group, e.g.); we just take
  // the first match per conversation.
  const rcRows = await db
    .selectDistinct({
      conversationId: telegramChats.conversationId,
      connectionId: telegramConnections.id,
      botUsername: telegramConnections.botUsername,
      botName: telegramConnections.name,
      kind: telegramConnections.kind,
    })
    .from(telegramChats)
    .innerJoin(
      telegramConnections,
      eq(telegramConnections.id, telegramChats.connectionId),
    )
    .where(inArray(telegramChats.conversationId, conversationIds))
    .all()
  for (const row of rcRows) {
    if (row.kind !== 'remote_control') continue
    if (byConversation.has(row.conversationId)) continue
    byConversation.set(row.conversationId, {
      connectionId: row.connectionId,
      botUsername: row.botUsername,
      botName: row.botName,
      kind: row.kind,
    })
  }

  const activeRows = await db
    .select({ conversationId: telegramActiveChat.conversationId })
    .from(telegramActiveChat)
    .where(inArray(telegramActiveChat.conversationId, conversationIds))
    .all()
  const activeIds = new Set(activeRows.map((r) => r.conversationId))

  return { byConversation, activeIds }
}
