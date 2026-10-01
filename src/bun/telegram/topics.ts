import { and, eq, isNull } from 'drizzle-orm'
import type { DB } from '../../db'
import { conversations } from '../../db/schema/conversations.sql'
import type { TelegramConnection } from '../../db/schema/telegram-connections.sql'
import {
  type TelegramTopic,
  telegramTopics,
} from '../../db/schema/telegram-topics.sql'
import { decryptSecret } from '../security/secrets'
import { createForumTopic, rateLimitDelayMs, TelegramApiError } from './api'

// The adapter encodes a Telegram thread as `telegram:<chatId>` for a
// plain chat and `telegram:<chatId>:<topicId>` when the message
// belongs to a forum topic. Routing keys off this string, so decoding
// it is the single point where topic identity enters Herbie.
export interface DecodedThreadId {
  telegramChatId: string
  messageThreadId: number | null
}

export function decodeThreadId(threadId: string): DecodedThreadId | null {
  if (!threadId.startsWith('telegram:')) return null
  const rest = threadId.slice('telegram:'.length)
  const sep = rest.lastIndexOf(':')
  if (sep === -1) return { telegramChatId: rest, messageThreadId: null }

  const chatId = rest.slice(0, sep)
  const topic = Number(rest.slice(sep + 1))
  // A chat id can itself be negative but never contains a colon, so a
  // non-numeric tail means the whole string is the chat id.
  if (!Number.isInteger(topic)) {
    return { telegramChatId: rest, messageThreadId: null }
  }
  return { telegramChatId: chatId, messageThreadId: topic }
}

export async function findTopicByThread(
  db: DB,
  connectionId: string,
  decoded: DecodedThreadId,
): Promise<TelegramTopic | undefined> {
  return await db
    .select()
    .from(telegramTopics)
    .where(
      and(
        eq(telegramTopics.connectionId, connectionId),
        eq(telegramTopics.telegramChatId, decoded.telegramChatId),
        // SQLite never matches `= NULL`, so the General topic (no
        // thread id) has to be looked up with IS NULL. Note SQLite also
        // treats NULLs as distinct in a unique index, so that row's
        // uniqueness is enforced by the conversation-keyed primary key
        // rather than by telegram_topics_thread_unique.
        decoded.messageThreadId === null
          ? isNull(telegramTopics.messageThreadId)
          : eq(telegramTopics.messageThreadId, decoded.messageThreadId),
      ),
    )
    .get()
}

export async function findTopicByConversation(
  db: DB,
  conversationId: string,
): Promise<TelegramTopic | undefined> {
  return await db
    .select()
    .from(telegramTopics)
    .where(eq(telegramTopics.conversationId, conversationId))
    .get()
}

export async function recordTopic(
  db: DB,
  row: {
    conversationId: string
    connectionId: string
    telegramChatId: string
    messageThreadId: number | null
    topicTitle: string | null
    syncState: TelegramTopic['syncState']
  },
): Promise<void> {
  const now = new Date()
  await db
    .insert(telegramTopics)
    .values({ ...row, lastError: null, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: telegramTopics.conversationId,
      set: {
        connectionId: row.connectionId,
        telegramChatId: row.telegramChatId,
        messageThreadId: row.messageThreadId,
        topicTitle: row.topicTitle,
        syncState: row.syncState,
        lastError: null,
        updatedAt: now,
      },
    })
    .run()
}

export async function markTopicError(
  db: DB,
  conversationId: string,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  await db
    .update(telegramTopics)
    .set({ syncState: 'error', lastError: message, updatedAt: new Date() })
    .where(eq(telegramTopics.conversationId, conversationId))
    .run()
}

/**
 * Topic for a conversation, created on demand.
 *
 * Returns null when the connection cannot host topics, which leaves
 * the caller on the pre-topics routing path rather than failing the
 * message. Creation is idempotent through the conversation-keyed row:
 * a conversation that already has a live topic never gets a second
 * one, so a retry after a partial failure rebinds instead of
 * duplicating.
 */
export async function ensureTopicForConversation(
  db: DB,
  connection: TelegramConnection,
  conversationId: string,
): Promise<TelegramTopic | null> {
  if (!connection.topicsEnabled || !connection.dmChatId) return null

  const existing = await findTopicByConversation(db, conversationId)
  if (existing && existing.syncState !== 'error') return existing

  const conv = await db
    .select({ title: conversations.title })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get()
  if (!conv) return null

  const token = await decryptSecret(connection.botTokenEncrypted)
  try {
    const topic = await createForumTopic(token, connection.dmChatId, conv.title)
    await recordTopic(db, {
      conversationId,
      connectionId: connection.id,
      telegramChatId: connection.dmChatId,
      messageThreadId: topic.messageThreadId,
      topicTitle: topic.name,
      syncState: 'live',
    })
    return (await findTopicByConversation(db, conversationId)) ?? null
  } catch (err) {
    // A rate limit means the topic does not exist yet, not that it
    // cannot. Rethrow so the caller can wait the time Telegram asked
    // for and try again, and leave the row unflagged: recording it as
    // an error here would also make the next attempt look like a
    // retry of a permanent failure.
    if (rateLimitDelayMs(err) !== null) throw err

    if (!existing) {
      await recordTopic(db, {
        conversationId,
        connectionId: connection.id,
        telegramChatId: connection.dmChatId,
        messageThreadId: null,
        topicTitle: conv.title,
        syncState: 'error',
      })
    }
    await markTopicError(db, conversationId, err)
    if (err instanceof TelegramApiError) {
      // biome-ignore lint/suspicious/noConsole: surfaces in dev/CI logs only
      console.error(
        `[telegram:topics] createForumTopic failed for ${conversationId}: ${err.message}`,
      )
    }
    return null
  }
}
