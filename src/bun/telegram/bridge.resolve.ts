import type { TelegramRawMessage } from '@chat-adapter/telegram'
import type { Message, Thread } from 'chat'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { DB } from '../../db'
import { conversations } from '../../db/schema/conversations.sql'
import { telegramActiveChat } from '../../db/schema/telegram-active-chat.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import {
  type TelegramConnection,
  telegramConnections,
} from '../../db/schema/telegram-connections.sql'
import { getDb } from '../db-singleton'
import { upsertActivePointer } from './commands.queries'

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

// Shared bootstrap for any inbound message that needs to spin up a
// fresh conversation: writes the conversations row + a telegram_chats
// row tying it to this Telegram chat, and returns the new
// conversationId. Callers are responsible for whatever pointer /
// connection state update follows (active pointer for RC,
// defaultConversationId for SP).
async function createTelegramConversation(
  db: DB,
  connection: TelegramConnection,
  message: TelegramMessageLike,
  telegramChatId: string,
  firstText: string,
): Promise<string> {
  const now = new Date()
  const conversationId = nanoid()
  await db
    .insert(conversations)
    .values({
      id: conversationId,
      title: makeTitle(firstText),
      agentId: connection.agentId,
      modelId: connection.modelId,
      workspacePath: connection.workspacePath,
      reasoningEffort: connection.reasoningEffort,
      acpxSessionId: null,
      acpxRecordId: null,
      agentSessionId: null,
      status: 'idle',
      origin: 'telegram',
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  await db
    .insert(telegramChats)
    .values({
      id: nanoid(),
      connectionId: connection.id,
      telegramChatId,
      chatKind: message.raw.chat.type,
      chatTitle: chatDisplayTitle(message),
      conversationId,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  return conversationId
}

async function ensureTelegramChatRow(
  db: DB,
  connection: TelegramConnection,
  message: TelegramMessageLike,
  telegramChatId: string,
  conversationId: string,
): Promise<void> {
  const existing = await db
    .select({ id: telegramChats.id })
    .from(telegramChats)
    .where(
      and(
        eq(telegramChats.connectionId, connection.id),
        eq(telegramChats.telegramChatId, telegramChatId),
        eq(telegramChats.conversationId, conversationId),
      ),
    )
    .get()
  if (existing) return
  const now = new Date()
  await db
    .insert(telegramChats)
    .values({
      id: nanoid(),
      connectionId: connection.id,
      telegramChatId,
      chatKind: message.raw.chat.type,
      chatTitle: chatDisplayTitle(message),
      conversationId,
      createdAt: now,
      updatedAt: now,
    })
    .run()
}

function makeTitle(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= 80) return trimmed
  return `${trimmed.slice(0, 77)}…`
}

function chatDisplayTitle(message: TelegramMessageLike): string | null {
  const chat = message.raw.chat
  if (chat.type === 'private') {
    return message.author.fullName || chat.username || null
  }
  return chat.title ?? null
}
