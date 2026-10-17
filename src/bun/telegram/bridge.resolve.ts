import type { TelegramRawMessage } from '@chat-adapter/telegram'
import type { Message, Thread } from 'chat'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { DB } from '../../db'
import { conversations } from '../../db/schema/conversations.sql'
import { telegramActiveChat } from '../../db/schema/telegram-active-chat.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import {
  type TelegramConnection,
  telegramConnections,
} from '../../db/schema/telegram-connections.sql'
import { getDb } from '../db-singleton'
import {
  createTelegramConversation,
  ensureTelegramChatRow,
} from './bridge.write'
import { upsertActivePointer } from './commands.queries'
import { findTopicByThread, recordTopic, topicRouteFor } from './topics'

// chat-sdk's handler signatures give us Message<unknown>; the adapter
// fills in TelegramMessage as the raw payload. Narrow at the boundary
// so the rest of the bridge has typed access to chat metadata.
export type TelegramMessageLike = Omit<Message, 'raw'> & {
  raw: TelegramRawMessage
}

// Branches on connection.kind. Special-purpose bots route via the
// connection's defaultConversationId (a single dedicated conversation
// per bot, auto-created on first message if unlinked). Remote-control
// bots route via the active pointer in telegram_active_chat with a
// fallback to the most-recent telegram_chats row (handles upgrade-
// from-1:1 and post-archive recovery), then auto-create if nothing
// is linked yet.
export async function resolveConversationId(
  connection: TelegramConnection,
  message: TelegramMessageLike,
  firstText: string,
  thread: Thread,
): Promise<string | null> {
  const db = getDb()
  const telegramChatId = String(message.raw.chat.id)

  // Topic routing comes first and is self-contained: when the message
  // carries a topic, that topic alone decides the conversation. The
  // bot kind, the active pointer and the slash commands all exist to
  // work around having a single addressable conversation per chat, so
  // none of them apply once the address is the topic itself.
  const topicConversationId = await resolveByTopic(
    db,
    connection,
    message,
    telegramChatId,
    firstText,
    thread,
  )
  if (topicConversationId) return topicConversationId

  if (connection.kind === 'special_purpose') {
    return resolveSpecialPurpose(
      db,
      connection,
      message,
      telegramChatId,
      firstText,
      thread,
    )
  }
  return resolveRemoteControl(
    db,
    connection,
    message,
    telegramChatId,
    firstText,
  )
}

async function resolveSpecialPurpose(
  db: DB,
  connection: TelegramConnection,
  message: TelegramMessageLike,
  telegramChatId: string,
  firstText: string,
  thread: Thread,
): Promise<string | null> {
  // Re-read defaultConversationId from the DB per message. The
  // `connection` arg is captured in chat.onDirectMessage's closure
  // at bot-start time and never refreshes, so any UPDATE here would
  // be invisible to the next message — making the auto-create branch
  // spawn a fresh conversation every time.
  const fresh = await db
    .select({
      defaultConversationId: telegramConnections.defaultConversationId,
    })
    .from(telegramConnections)
    .where(eq(telegramConnections.id, connection.id))
    .get()
  const defaultConversationId = fresh?.defaultConversationId ?? null

  // 1. Pointed at an existing live conversation → route there.
  if (defaultConversationId) {
    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, defaultConversationId))
      .get()
    if (conv?.archivedAt) {
      // User intentionally archived this conversation. Don't silently
      // create a new one — surface the state so they can restore /
      // re-link from the desktop.
      await thread.post(
        `⚠ "${conv.title}" is archived.\n` +
          'Restore it from the desktop app, or re-link this bot to a different conversation.',
      )
      return null
    }
    if (conv) {
      // Idempotent record of this Telegram chat as a viewport on the
      // bot — used by the reassign flow to fan out notices.
      await ensureTelegramChatRow(
        db,
        connection,
        message,
        telegramChatId,
        conv.id,
      )
      return conv.id
    }
    // conv === undefined means the FK didn't get cleared by ON DELETE
    // SET NULL (older schema / manual surgery). Fall through to
    // auto-create rather than dead-ending.
  }

  // 2. No (live) target → auto-create. This is the common path for
  //    SP bots added via Mobile settings without explicitly linking
  //    them at creation time — first inbound message bootstraps the
  //    dedicated conversation, exactly like the pre-feature behavior.
  //    After this point, every future message routes via
  //    defaultConversationId on the fast path.
  const conversationId = await createTelegramConversation(
    db,
    connection,
    message,
    telegramChatId,
    firstText,
  )
  await db
    .update(telegramConnections)
    .set({ defaultConversationId: conversationId, updatedAt: new Date() })
    .where(eq(telegramConnections.id, connection.id))
    .run()
  return conversationId
}

async function resolveRemoteControl(
  db: DB,
  connection: TelegramConnection,
  message: TelegramMessageLike,
  telegramChatId: string,
  firstText: string,
): Promise<string> {
  // 1. Fast path — active pointer for this (bot, telegram chat).
  const active = await db
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
  if (active) return active.conversationId

  // 2. Fallback — most-recent non-archived telegram_chats row for this
  //    pair. Covers two cases: post-archive recovery (active pointer
  //    was on a now-archived conversation) and upgrade-from-1:1
  //    (existing telegram_chats rows have no active pointer yet).
  const fallback = await db
    .select({ conversationId: telegramChats.conversationId })
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
    .get()
  if (fallback) {
    await upsertActivePointer(
      db,
      connection.id,
      telegramChatId,
      fallback.conversationId,
    )
    return fallback.conversationId
  }

  // 3. Auto-create — first message in this Telegram chat with no
  //    pre-existing pool. Same shape as the pre-feature behavior, but
  //    we also write the active pointer now so the next message lands
  //    on the fast path.
  const conversationId = await createTelegramConversation(
    db,
    connection,
    message,
    telegramChatId,
    firstText,
  )
  await upsertActivePointer(db, connection.id, telegramChatId, conversationId)
  return conversationId
}

/**
 * Conversation addressed by the message's forum topic, or null when
 * topic routing does not apply.
 *
 * Null covers three cases that all fall through to the pre-topics
 * path: the connection has no topics, the adapter handed us a thread
 * id we cannot decode, and the message arrived outside any topic.
 * That last one matters because the General topic is where messages
 * land in a chat whose topics were only just switched on, and
 * stealing those would strand the conversation the user was already
 * talking to.
 */
async function resolveByTopic(
  db: DB,
  connection: TelegramConnection,
  message: TelegramMessageLike,
  telegramChatId: string,
  firstText: string,
  thread: Thread,
): Promise<string | null> {
  const decoded = topicRouteFor(connection, thread.id)
  if (!decoded) return null

  const existing = await findTopicByThread(db, connection.id, decoded)
  if (existing) {
    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, existing.conversationId))
      .get()
    if (conv && !conv.archivedAt) return conv.id
    if (conv?.archivedAt) {
      await thread.post(
        `⚠ "${conv.title}" is archived.\n` +
          'Restore it from the desktop app to keep using this topic.',
      )
      return null
    }
    // The conversation is gone but the row survived. Fall through and
    // adopt the topic again rather than dead-ending the message.
  }

  // A topic Herbie has never seen: the user created it on the phone.
  // Adopt it as a new conversation, named after the topic when
  // Telegram tells us the name.
  const topicName = topicNameFromServiceMessage(message.raw)
  const conversationId = await createTelegramConversation(
    db,
    connection,
    message,
    telegramChatId,
    topicName ?? firstText,
  )
  await recordTopic(db, {
    conversationId,
    connectionId: connection.id,
    telegramChatId,
    messageThreadId: decoded.messageThreadId,
    topicTitle: topicName ?? null,
    syncState: 'live',
  })
  return conversationId
}

// Telegram announces a new topic with a `forum_topic_created` service
// message, which the first user message in that topic replies to. The
// adapter's TelegramMessage does not model the forum service
// messages, so narrow structurally rather than widening its type.
function topicNameFromServiceMessage(raw: object): string | null {
  if (!('reply_to_message' in raw)) return null
  const reply = raw.reply_to_message
  if (typeof reply !== 'object' || reply === null) return null
  if (!('forum_topic_created' in reply)) return null
  const created = reply.forum_topic_created
  if (typeof created !== 'object' || created === null) return null
  if (!('name' in created)) return null
  return typeof created.name === 'string' ? created.name : null
}
