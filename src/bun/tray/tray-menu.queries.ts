import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { DB } from '../../db'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { conversations } from '../../db/schema/conversations.sql'
import { inboxItems } from '../../db/schema/inbox-items.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import { telegramConnections } from '../../db/schema/telegram-connections.sql'

// Three independent reads + a count. Run in parallel so the tray
// rebuild round-trip is a single Promise.all() at the call site.

export const TOP_LIMIT = 3
export const MORE_LIMIT = 15
const TOTAL = TOP_LIMIT + MORE_LIMIT

export type InboxRow = {
  id: string
  taskName: string
  workspacePath: string | null
  createdAt: Date
}

export async function fetchRecentInbox(db: DB): Promise<InboxRow[]> {
  return db
    .select({
      id: inboxItems.id,
      taskName: inboxItems.taskName,
      workspacePath: inboxItems.workspacePath,
      createdAt: inboxItems.createdAt,
    })
    .from(inboxItems)
    .orderBy(desc(inboxItems.createdAt))
    .limit(TOTAL)
    .all()
}

export async function countInboxUnread(db: DB): Promise<number> {
  const row = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(inboxItems)
    .where(eq(inboxItems.status, 'unread'))
    .get()
  return Number(row?.n ?? 0)
}

export type TelegramBotRow = {
  connectionId: string
  botUsername: string | null
  connectionName: string
  chats: Array<{
    conversationId: string
    chatTitle: string | null
    conversationTitle: string
    telegramChatId: string
    updatedAt: Date
    unreadCount: number
  }>
  unreadCount: number
}

export async function fetchTelegramBots(db: DB): Promise<TelegramBotRow[]> {
  // Pull every (bot × non-archived chat) row in one shot with the
  // per-conversation unread count from a correlated subquery, then
  // group in JS — easier than emulating window functions in SQLite.
  const rows = await db
    .select({
      connectionId: telegramConnections.id,
      botUsername: telegramConnections.botUsername,
      connectionName: telegramConnections.name,
      conversationId: telegramChats.conversationId,
      chatTitle: telegramChats.chatTitle,
      conversationTitle: conversations.title,
      telegramChatId: telegramChats.telegramChatId,
      updatedAt: conversations.updatedAt,
      unreadCount: sql<number>`(
        SELECT COUNT(*) FROM ${chatEvents}
        WHERE ${chatEvents.conversationId} = ${conversations.id}
          AND (${conversations.lastSeenAt} IS NULL
               OR ${chatEvents.createdAt} > ${conversations.lastSeenAt})
      )`,
    })
    .from(telegramConnections)
    .innerJoin(
      telegramChats,
      eq(telegramChats.connectionId, telegramConnections.id),
    )
    .innerJoin(
      conversations,
      eq(conversations.id, telegramChats.conversationId),
    )
    .where(isNull(conversations.archivedAt))
    .orderBy(desc(conversations.updatedAt))
    .all()

  // Since we dropped the unique index on telegram_chats(connection_id,
  // telegram_chat_id), a single conversation can be linked through
  // multiple Telegram chats (a DM AND a group). Dedupe per bot by
  // conversation_id — show each conversation once, taking the most
  // recent (first-seen since rows are sorted DESC).
  const byBot = new Map<string, { row: TelegramBotRow; seen: Set<string> }>()
  for (const r of rows) {
    const chat = {
      conversationId: r.conversationId,
      chatTitle: r.chatTitle,
      conversationTitle: r.conversationTitle,
      telegramChatId: r.telegramChatId,
      updatedAt: r.updatedAt,
      unreadCount: Number(r.unreadCount),
    }
    const existing = byBot.get(r.connectionId)
    if (existing) {
      if (existing.seen.has(chat.conversationId)) continue
      existing.seen.add(chat.conversationId)
      existing.row.chats.push(chat)
      existing.row.unreadCount += chat.unreadCount
    } else {
      byBot.set(r.connectionId, {
        row: {
          connectionId: r.connectionId,
          botUsername: r.botUsername,
          connectionName: r.connectionName,
          chats: [chat],
          unreadCount: chat.unreadCount,
        },
        seen: new Set([chat.conversationId]),
      })
    }
  }
  // SELECT was ordered by chat updatedAt DESC, so first-seen bot
  // determines its rank. Map preserves insert order → array is
  // already in the right order for the menu.
  return [...byBot.values()].map((b) => b.row).slice(0, TOTAL)
}

export type ChatRow = {
  id: string
  title: string
  workspacePath: string | null
}

export async function fetchRecentChats(db: DB): Promise<ChatRow[]> {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      workspacePath: conversations.workspacePath,
    })
    .from(conversations)
    .where(
      and(eq(conversations.origin, 'chat'), isNull(conversations.archivedAt)),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(TOTAL)
    .all()
}
