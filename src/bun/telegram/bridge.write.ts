import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { DB } from '../../db'
import { conversations } from '../../db/schema/conversations.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import type { TelegramConnection } from '../../db/schema/telegram-connections.sql'
import type { TelegramMessageLike } from './bridge.resolve'

// Shared bootstrap for any inbound message that needs to spin up a
// fresh conversation: writes the conversations row + a telegram_chats
// row tying it to this Telegram chat, and returns the new
// conversationId. Callers are responsible for whatever pointer /
// connection state update follows (active pointer for RC,
// defaultConversationId for SP).
export async function createTelegramConversation(
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

// Records this Telegram chat as a known viewport on the bot.
// Idempotent on (connectionId, telegramChatId, conversationId) —
// used by the reassign flow to know which Telegram chats to fan a
// notice out to.
export async function ensureTelegramChatRow(
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
