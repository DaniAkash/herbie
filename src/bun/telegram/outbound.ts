import { eq } from 'drizzle-orm'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import { getDb } from '../db-singleton'
import { streamTurnToThread } from './forwarder'
import { getTelegramManager } from './manager'

// Mirrors an app-initiated turn back to the Telegram thread tied to
// the conversation, if any. Called from POST /chat/:id/messages
// after appendUserMessage returns. The user's own message goes out
// first with a "(from app)" prefix so the Telegram user can tell it
// was typed in the desktop app; the agent's streaming reply follows
// the same path the inbound handler uses.
//
// Silently no-ops when:
//  - the conversation isn't Telegram-mapped (normal in-app chats)
//  - the connection is paused/error and the bot isn't running
//
// The mirror runs as fire-and-forget — failures don't block the HTTP
// response back to the renderer; the app-side reply still streams as
// normal.
export async function mirrorAppTurnToTelegram(
  conversationId: string,
  requestId: string,
  userText: string,
): Promise<void> {
  const mapping = await getDb()
    .select()
    .from(telegramChats)
    .where(eq(telegramChats.conversationId, conversationId))
    .get()
  if (!mapping) return

  const thread = getTelegramManager().getThread(
    mapping.connectionId,
    mapping.telegramChatId,
  )
  if (!thread) return

  try {
    await thread.post(`_💬 from app_\n${userText}`)
  } catch (err) {
    // Don't kill the forwarder if the user-message post fails (rate
    // limit, network blip); we still want to attempt to mirror the
    // agent's reply.
    logError(conversationId, 'mirroring user message failed', err)
  }
  await streamTurnToThread(conversationId, requestId, thread)
}

function logError(conversationId: string, label: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  // biome-ignore lint/suspicious/noConsole: surfaces in dev/CI logs only
  console.error(`[telegram:outbound:${conversationId}] ${label}: ${message}`)
}
