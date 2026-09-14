import type { Message, Thread } from 'chat'
import { eq } from 'drizzle-orm'
import { conversations } from '../../db/schema/conversations.sql'
import {
  type TelegramConnection,
  telegramConnections,
} from '../../db/schema/telegram-connections.sql'
import { TurnInProgressError } from '../chat/ChatSession'
import { getSessionManager } from '../chat/sessionManager'
import { getDb } from '../db-singleton'
import { getTrayBinding } from '../tray/binding'
import { backfillTopics } from './backfill'
import {
  resolveConversationId,
  type TelegramMessageLike,
} from './bridge.resolve'
import { handleBotCommand } from './commands'
import { isManagementCommand } from './commands.format'
import { applyLearnedFields } from './connection-learn'
import { beginTurnCapture } from './forwarder'
import { decodeThreadId } from './topics'
import { conversationTurnTuple } from './turn-tuple'

// One inbound Telegram message → one ChatSession turn → streamed reply
// back to the Telegram thread. The bridge owns conversation/mapping
// row creation (via resolveConversationId) and the per-turn bus
// subscription that fans assistant.text events back to thread.post().
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

  // Fold in what this message reveals about the connection (the DM's
  // chat id, whether topics are on) before anything routes, so the
  // very first message can already take the topic path.
  await applyLearnedFields(getDb(), connection, message.raw)
  const freshConnection =
    (await getDb()
      .select()
      .from(telegramConnections)
      .where(eq(telegramConnections.id, connection.id))
      .get()) ?? connection

  // The moment topics become usable, give every conversation one so the
  // topic list matches the sidebar. Self-throttling and single-flight,
  // so repeat messages during a long backfill are no-ops.
  if (freshConnection.topicsEnabled && freshConnection.dmChatId) {
    void backfillTopics(freshConnection)
  }

  // Bot-command interception: /help, /list, /switch, /new, /current,
  // /archive, /unarchive. Commands run before the AI turn pipeline so
  // a /new doesn't accidentally land as user text in the previous
  // active conversation.
  const telegramChatId = String(message.raw.chat.id)
  // The management commands all operate on the chat-level active
  // pointer, which is not what addresses a conversation inside a
  // topic. Rather than act on the wrong conversation, say so: topics
  // make these commands unnecessary anyway, since the topic itself is
  // the selection.
  const inTopic = decodeThreadId(thread.id)?.messageThreadId != null
  if (inTopic && isManagementCommand(text)) {
    await thread.post(
      'This topic is its own conversation, so there is nothing to switch. ' +
        'Use the desktop app to create, rename or archive conversations.',
    )
    return
  }
  const handled = await handleBotCommand(
    connection,
    thread,
    telegramChatId,
    text,
  )
  if (handled) {
    getTrayBinding().refresh()
    return
  }

  const conversationId = await resolveConversationId(
    freshConnection,
    message,
    text,
    thread,
  )
  // resolveConversationId returns null when a special_purpose bot is
  // in an unassigned/archived state — it already posted the user-facing
  // explainer, so just bail.
  if (!conversationId) return

  // Refresh the tray as soon as the conversation row exists so its
  // Telegram section reorders / shows the new bot before the agent
  // even starts streaming. (The Hono middleware can't see this path
  // — chat-sdk's handlers run outside the request cycle.)
  getTrayBinding().refresh()
  // Listen before the turn starts. A fast provider can finish before a
  // later subscription exists, and nothing replays those events.
  const capture = beginTurnCapture(conversationId, thread)
  const requestId = await startTurn(conversationId, text, thread)
  if (!requestId) {
    capture.abandon()
    return
  }
  await capture.bind(requestId)
  // Second refresh after the turn settles so unread counts update.
  getTrayBinding().refresh()
}

async function startTurn(
  conversationId: string,
  text: string,
  thread: Thread,
): Promise<string | null> {
  const conv = await getDb()
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get()
  if (!conv) {
    await thread.post("Couldn't find that conversation any more.")
    return null
  }

  const session = await getSessionManager().getOrCreate(conversationId)
  const tuple = conversationTurnTuple(conv)
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
