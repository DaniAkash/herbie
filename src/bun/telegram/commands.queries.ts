import { and, desc, eq, isNull } from 'drizzle-orm'
import type { DB } from '../../db'
import { conversations } from '../../db/schema/conversations.sql'
import { telegramActiveChat } from '../../db/schema/telegram-active-chat.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import type { TelegramConnection } from '../../db/schema/telegram-connections.sql'

export interface ConversationListItem {
  conversationId: string
  title: string
  updatedAt: Date
  modelId: string | null
}

// Top 20 non-archived conversations for this (bot, telegram chat),
// ordered by recency. The number a user types in /switch / /archive
// is a 1-based index into this exact list. SELECT DISTINCT in case
// older builds wrote duplicate telegram_chats rows for the same
// (connection, chat, conversation) tuple.
export async function listConversationsForChat(
  db: DB,
  connection: TelegramConnection,
  telegramChatId: string,
): Promise<ConversationListItem[]> {
  return await db
    .selectDistinct({
      conversationId: telegramChats.conversationId,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
      modelId: conversations.modelId,
    })
    .from(telegramChats)
    .innerJoin(
      conversations,
      eq(conversations.id, telegramChats.conversationId),
    )
    .where(
      and(
        eq(telegramChats.connectionId, connection.id),
        eq(telegramChats.telegramChatId, telegramChatId),
        isNull(conversations.archivedAt),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(20)
    .all()
}

// Resolves the currently-active conversation id for the pair. Returns
// null when no pointer exists OR when the pointer aims at an archived
// conversation (the JOIN filters out the archived case so we don't
// route into a hidden row).
export async function findActiveConversationId(
  db: DB,
  connection: TelegramConnection,
  telegramChatId: string,
): Promise<string | null> {
  const row = await db
    .select({ conversationId: telegramActiveChat.conversationId })
    .from(telegramActiveChat)
    .innerJoin(
      conversations,
      eq(conversations.id, telegramActiveChat.conversationId),
    )
    .where(
      and(
        eq(telegramActiveChat.connectionId, connection.id),
        eq(telegramActiveChat.telegramChatId, telegramChatId),
        isNull(conversations.archivedAt),
      ),
    )
    .get()
  return row?.conversationId ?? null
}

// Single-shot upsert that swaps the active pointer atomically.
export async function upsertActivePointer(
  db: DB,
  connectionId: string,
  telegramChatId: string,
  conversationId: string,
): Promise<void> {
  const now = new Date()
  await db
    .insert(telegramActiveChat)
    .values({ connectionId, telegramChatId, conversationId, updatedAt: now })
    .onConflictDoUpdate({
      target: [
        telegramActiveChat.connectionId,
        telegramActiveChat.telegramChatId,
      ],
      set: { conversationId, updatedAt: now },
    })
    .run()
}
