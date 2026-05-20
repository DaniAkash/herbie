import { eq } from 'drizzle-orm'
import { conversations } from '../../db/schema/conversations.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import { telegramConnections } from '../../db/schema/telegram-connections.sql'
import { getDb } from '../db-singleton'
import { truncate } from './commands.format'
import { getTelegramManager } from './manager'

export interface ReassignResult {
  ok: true
  previousConversationTitle: string | null
  newConversationTitle: string
  chatsNotified: number
}

export type ReassignError =
  | { ok: false; code: 'connection_not_found' }
  | { ok: false; code: 'not_special_purpose' }
  | { ok: false; code: 'conversation_not_found' }
  | { ok: false; code: 'conversation_archived' }
  | { ok: false; code: 'no_change' }

// Reassigns a special-purpose bot's defaultConversationId to a new
// conversation. After the atomic UPDATE, fans out a "this bot has
// been reassigned" notice to every Telegram chat where this bot has
// been seen — so anyone scrolling the bot's chat history later sees
// a clean cut between the old conversation and the new one.
//
// Telegram notices are best-effort: rate limits, dropped sessions,
// missing thread handles all bail without failing the reassignment
// itself. The desktop UI gets back a count of chats notified.
export async function reassignSpecialPurposeBot(
  connectionId: string,
  newConversationId: string,
): Promise<ReassignResult | ReassignError> {
  const db = getDb()
  const connection = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.id, connectionId))
    .get()
  if (!connection) return { ok: false, code: 'connection_not_found' }
  if (connection.kind !== 'special_purpose') {
    return { ok: false, code: 'not_special_purpose' }
  }

  const newConv = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      archivedAt: conversations.archivedAt,
    })
    .from(conversations)
    .where(eq(conversations.id, newConversationId))
    .get()
  if (!newConv) return { ok: false, code: 'conversation_not_found' }
  if (newConv.archivedAt) {
    return { ok: false, code: 'conversation_archived' }
  }

  if (connection.defaultConversationId === newConversationId) {
    return { ok: false, code: 'no_change' }
  }

  // Capture the previous conversation title for the notice before we
  // overwrite the pointer. defaultConversationId may be null on a
  // freshly-created-but-never-linked bot.
  let previousTitle: string | null = null
  if (connection.defaultConversationId) {
    const prev = await db
      .select({ title: conversations.title })
      .from(conversations)
      .where(eq(conversations.id, connection.defaultConversationId))
      .get()
    previousTitle = prev?.title ?? null
  }

  const now = new Date()
  await db
    .update(telegramConnections)
    .set({ defaultConversationId: newConversationId, updatedAt: now })
    .where(eq(telegramConnections.id, connectionId))
    .run()

  const chatsNotified = await notifyTelegramChats(
    connectionId,
    previousTitle,
    newConv.title,
  )

  return {
    ok: true,
    previousConversationTitle: previousTitle,
    newConversationTitle: newConv.title,
    chatsNotified,
  }
}

// Posts the reassignment notice to every known Telegram chat this bot
// has interacted with. Each thread.post is independently best-effort
// — one failure doesn't block the rest. Returns the count of chats
// where the post succeeded.
async function notifyTelegramChats(
  connectionId: string,
  previousTitle: string | null,
  newTitle: string,
): Promise<number> {
  const db = getDb()
  const chats = await db
    .selectDistinct({ telegramChatId: telegramChats.telegramChatId })
    .from(telegramChats)
    .where(eq(telegramChats.connectionId, connectionId))
    .all()
  if (chats.length === 0) return 0

  const manager = getTelegramManager()
  const notice = buildNotice(previousTitle, newTitle)
  let posted = 0
  await Promise.all(
    chats.map(async ({ telegramChatId }) => {
      const thread = manager.getThread(connectionId, telegramChatId)
      if (!thread) return
      try {
        await thread.post(notice)
        posted++
      } catch (err) {
        // Best-effort: log + continue. Rate limits / blocked-by-user /
        // bot-not-running all land here.
        const message = err instanceof Error ? err.message : String(err)
        // biome-ignore lint/suspicious/noConsole: dev-debug only
        console.warn(
          `[telegram:${connectionId}] reassign notice failed for chat ${telegramChatId}: ${message}`,
        )
      }
    }),
  )
  return posted
}

function buildNotice(previousTitle: string | null, newTitle: string): string {
  const lines: string[] = ['🔄 This bot has been reassigned.', '']
  if (previousTitle) {
    lines.push(`Was linked to:\n   "${truncate(previousTitle, 60)}"`)
    lines.push('')
  }
  lines.push(`Now linked to:\n   "${truncate(newTitle, 60)}"`)
  lines.push('')
  lines.push('Messages from here now go to the new conversation.')
  if (previousTitle) {
    lines.push('')
    lines.push(
      `"${truncate(previousTitle, 40)}" is still in the Herbie sidebar ` +
        "but isn't reachable from Telegram. Use Send to Telegram in the " +
        'app to re-link it.',
    )
  }
  return lines.join('\n')
}
