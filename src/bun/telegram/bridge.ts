import type { Message, Thread } from 'chat'
import type { TelegramConnection } from '../../db/schema/telegram-connections.sql'
import { TurnInProgressError } from '../chat/ChatSession'
import { getSessionManager } from '../chat/sessionManager'
import type { ChatTuple } from '../chat/tuple'
import { getTrayBinding } from '../tray/binding'
import {
  resolveConversationId,
  type TelegramMessageLike,
} from './bridge.resolve'
import { handleBotCommand } from './commands'
import { streamTurnToThread } from './forwarder'

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

  // Bot-command interception: /help, /list, /switch, /new, /current,
  // /archive, /unarchive. Commands run before the AI turn pipeline so
  // a /new doesn't accidentally land as user text in the previous
  // active conversation.
  const telegramChatId = String(message.raw.chat.id)
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
    connection,
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
