import type { TelegramRawMessage } from '@chat-adapter/telegram'
import type { Message, Thread } from 'chat'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { conversations } from '../../db/schema/conversations.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import type { TelegramConnection } from '../../db/schema/telegram-connections.sql'
import { TurnInProgressError } from '../chat/ChatSession'
import { getSessionManager } from '../chat/sessionManager'
import type { ChatTuple } from '../chat/tuple'
import { getDb } from '../db-singleton'
import { getTrayBinding } from '../tray/binding'
import { streamTurnToThread } from './forwarder'

// chat-sdk's handler signatures give us Message<unknown>; the adapter
// fills in TelegramMessage as the raw payload. Narrow at the boundary
// so the rest of the bridge has typed access to chat metadata.
type TelegramMessageLike = Omit<Message, 'raw'> & {
  raw: TelegramRawMessage
}

// One inbound Telegram message → one ChatSession turn → streamed reply
// back to the Telegram thread. The bridge owns conversation/mapping
// row creation and the per-turn bus subscription that fans
// assistant.text events back to thread.post().
export async function handleIncomingTelegramMessage(
  connection: TelegramConnection,
  thread: Thread,
  rawMessage: Message,
): Promise<void> {
  const message = rawMessage as TelegramMessageLike
  // Skip messages without text (photos/audio/etc) for v1. Tell the
  // user politely instead of silently dropping so they don't think
  // the bot is broken.
  const text = message.text?.trim()
  if (!text) {
    await thread.post(
      'I can only handle text messages right now — try typing your request.',
    )
    return
  }

  const conversationId = await resolveConversationId(connection, message, text)
  // Refresh the tray as soon as the conversation row exists so its
  // Telegram section reorders / shows the new bot before the agent
  // even starts streaming. (The Hono middleware can't see this path
  // — chat-sdk's handlers run outside the request cycle.)
  getTrayBinding().refresh()
  const requestId = await startTurn(connection, conversationId, text, thread)
  if (!requestId) return
  await streamTurnToThread(conversationId, requestId, thread)
  // Second refresh after the turn settles so unread counts update.
  getTrayBinding().refresh()
}

async function startTurn(
  connection: TelegramConnection,
  conversationId: string,
  text: string,
  thread: Thread,
): Promise<string | null> {
  const session = await getSessionManager().getOrCreate(conversationId)
  const tuple: ChatTuple = {
    agentId: connection.agentId,
    modelId: connection.modelId,
    workspacePath: connection.workspacePath,
    reasoningEffort: connection.reasoningEffort,
  }
  try {
    const result = await session.appendUserMessage(text, tuple)
    return result.requestId
  } catch (err) {
    if (err instanceof TurnInProgressError) {
      await thread.post(
        '⏳ Still working on your previous message — give me a moment and try again.',
      )
      return null
    }
    const msg = err instanceof Error ? err.message : String(err)
    await thread.post(`❌ Couldn't start the turn: ${msg}`)
    return null
  }
}

async function resolveConversationId(
  connection: TelegramConnection,
  message: TelegramMessageLike,
  firstText: string,
): Promise<string> {
  const db = getDb()
  const telegramChatId = String(message.raw.chat.id)

  const existing = await db
    .select()
    .from(telegramChats)
    .where(
      and(
        eq(telegramChats.connectionId, connection.id),
        eq(telegramChats.telegramChatId, telegramChatId),
      ),
    )
    .get()
  if (existing) return existing.conversationId

  // New chat: create the conversation row and the mapping. Done as
  // separate INSERTs since drizzle/libsql don't need a wrapping txn
  // for two independent writes — if the mapping insert fails, the
  // orphan conversation row will get pruned by ON DELETE CASCADE the
  // next time the connection is removed.
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
