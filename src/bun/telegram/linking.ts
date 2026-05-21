import type { Thread } from 'chat'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { DB } from '../../db'
import { conversations } from '../../db/schema/conversations.sql'
import { pendingTelegramLinks } from '../../db/schema/pending-telegram-links.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import {
  type TelegramConnection,
  telegramConnections,
} from '../../db/schema/telegram-connections.sql'
import { getDb } from '../db-singleton'
import { truncate } from './commands.format'
import { upsertActivePointer } from './commands.queries'

// Tokens issued by POST /telegram/connections/:id/links are prefixed
// in the deep-link payload so the bot can distinguish a linking
// /start from a generic /start. The opaque suffix is what we look up.
const TOKEN_PREFIX = 'link_'

export interface LinkingResult {
  // True when the token was recognized and consumed (success path).
  // Caller skips the regular /start → cmdHelp dispatch.
  handled: boolean
}

// Handles /start <payload>. When payload looks like 'link_<token>',
// validates and consumes the token to link this Telegram chat to a
// pending conversation. Otherwise returns { handled: false } and the
// caller falls through to the generic /help reply.
export async function tryConsumeLinkingStart(
  connection: TelegramConnection,
  thread: Thread,
  telegramChatId: string,
  args: string[],
): Promise<LinkingResult> {
  const payload = args[0]
  if (!payload?.startsWith(TOKEN_PREFIX)) return { handled: false }
  const token = payload.slice(TOKEN_PREFIX.length)
  if (!token) return { handled: false }

  const db = getDb()
  const link = await db
    .select()
    .from(pendingTelegramLinks)
    .where(eq(pendingTelegramLinks.token, token))
    .get()
  if (!link) {
    await thread.post(
      '⚠ This link is invalid or has already been used.\n\n' +
        'Generate a fresh one from the Herbie desktop app and try again.',
    )
    return { handled: true }
  }

  // Tokens are bot-scoped — the desktop popup mints them tied to a
  // specific bot. A user opening a stale token in the wrong bot
  // shouldn't accidentally link a conversation to the wrong place.
  // We intentionally do NOT delete the token here: it's still valid
  // for the bot it was minted for, and the user may simply have
  // tapped through to the wrong bot first. Token expires on its own
  // TTL.
  if (link.connectionId !== connection.id) {
    await thread.post(
      '⚠ This link was issued for a different bot. Open the correct bot from the Herbie desktop app to use it, or wait for the link to expire.',
    )
    return { handled: true }
  }

  if (link.expiresAt < new Date()) {
    await db
      .delete(pendingTelegramLinks)
      .where(eq(pendingTelegramLinks.token, token))
      .run()
    await thread.post(
      '⚠ This link has expired.\n\n' +
        'Generate a fresh one from the Herbie desktop app and try again.',
    )
    return { handled: true }
  }

  const conv = await db
    .select({ id: conversations.id, title: conversations.title })
    .from(conversations)
    .where(eq(conversations.id, link.conversationId))
    .get()
  if (!conv) {
    // Token's conversation got deleted between mint and consume. The
    // FK cascade should already have deleted the token row, so this
    // branch is mostly defensive.
    await db
      .delete(pendingTelegramLinks)
      .where(eq(pendingTelegramLinks.token, token))
      .run()
    await thread.post(
      '⚠ The conversation this link was for is no longer available.',
    )
    return { handled: true }
  }

  if (connection.kind === 'special_purpose') {
    await applySpecialPurposeLink(db, connection.id, link.conversationId)
  } else {
    await applyRemoteControlLink(
      db,
      connection.id,
      telegramChatId,
      link.conversationId,
    )
  }

  // One-shot: consume the token so a refresh / re-tap doesn't double-link.
  await db
    .delete(pendingTelegramLinks)
    .where(eq(pendingTelegramLinks.token, token))
    .run()

  await thread.post(
    [
      '✅ Linked!',
      '',
      `"${truncate(conv.title, 60)}" is now reachable from here.`,
      '',
      connection.kind === 'remote_control'
        ? 'Type /list to see all your conversations.'
        : 'Type your next message to continue.',
    ].join('\n'),
  )
  return { handled: true }
}

async function applySpecialPurposeLink(
  db: DB,
  connectionId: string,
  conversationId: string,
): Promise<void> {
  const now = new Date()
  await db
    .update(telegramConnections)
    .set({ defaultConversationId: conversationId, updatedAt: now })
    .where(eq(telegramConnections.id, connectionId))
    .run()
}

async function applyRemoteControlLink(
  db: DB,
  connectionId: string,
  telegramChatId: string,
  conversationId: string,
): Promise<void> {
  // Ensure a telegram_chats row exists so /list surfaces this
  // conversation. Idempotent if the same conversation got linked
  // twice in this Telegram chat (e.g., user re-issued a token).
  const existing = await db
    .select({ id: telegramChats.id })
    .from(telegramChats)
    .where(
      and(
        eq(telegramChats.connectionId, connectionId),
        eq(telegramChats.telegramChatId, telegramChatId),
        eq(telegramChats.conversationId, conversationId),
      ),
    )
    .get()
  if (!existing) {
    const now = new Date()
    await db
      .insert(telegramChats)
      .values({
        id: nanoid(),
        connectionId,
        telegramChatId,
        // chatKind is updated by ensureTelegramChatRow when the first
        // non-command message arrives and we know the actual chat type.
        chatKind: 'private',
        chatTitle: null,
        conversationId,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }
  await upsertActivePointer(db, connectionId, telegramChatId, conversationId)
}
