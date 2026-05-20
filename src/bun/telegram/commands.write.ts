import type { Thread } from 'chat'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { DB } from '../../db'
import { conversations } from '../../db/schema/conversations.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import type { TelegramConnection } from '../../db/schema/telegram-connections.sql'
import { truncate } from './commands.format'
import {
  findActiveConversationId,
  listConversationsForChat,
  upsertActivePointer,
} from './commands.queries'

export async function cmdSwitch(
  db: DB,
  connection: TelegramConnection,
  thread: Thread,
  telegramChatId: string,
  nArg: string,
): Promise<void> {
  const n = Number.parseInt(nArg, 10)
  if (!Number.isFinite(n) || n < 1) {
    await thread.post('Usage: /switch <number>\n/list to see the numbers.')
    return
  }
  const items = await listConversationsForChat(db, connection, telegramChatId)
  if (n > items.length) {
    await thread.post(
      `${n} is out of range. You have ${items.length} conversation${
        items.length === 1 ? '' : 's'
      }.\n/list to see them.`,
    )
    return
  }
  const target = items[n - 1]
  if (!target) return
  const currentActive = await findActiveConversationId(
    db,
    connection,
    telegramChatId,
  )
  if (currentActive === target.conversationId) {
    await thread.post(
      `ℹ Already in "${truncate(target.title, 50)}". /list to see others.`,
    )
    return
  }
  await upsertActivePointer(
    db,
    connection.id,
    telegramChatId,
    target.conversationId,
  )
  await thread.post(
    `✅ Switched to "${truncate(target.title, 50)}"\n\nType your message to continue.`,
  )
}

export async function cmdNew(
  db: DB,
  connection: TelegramConnection,
  thread: Thread,
  telegramChatId: string,
  title: string,
): Promise<void> {
  const now = new Date()
  const conversationId = nanoid()
  const trimmedTitle = title
    ? truncate(title.replace(/\s+/g, ' ').trim(), 80)
    : 'New conversation'

  // Capture the current active title for the "↩ back to X" hint
  // before we overwrite the pointer.
  const previousActiveId = await findActiveConversationId(
    db,
    connection,
    telegramChatId,
  )
  const previousTitle = previousActiveId
    ? (
        await db
          .select({ title: conversations.title })
          .from(conversations)
          .where(eq(conversations.id, previousActiveId))
          .get()
      )?.title
    : undefined

  await db
    .insert(conversations)
    .values({
      id: conversationId,
      title: trimmedTitle,
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
      // chatKind is updated when an inbound non-command message arrives
      // and re-runs ensureTelegramChatRow with the raw message in hand.
      chatKind: 'private',
      chatTitle: null,
      conversationId,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  await upsertActivePointer(db, connection.id, telegramChatId, conversationId)

  const lines: string[] = [
    `🆕 "${trimmedTitle}" (active)`,
    '',
    `Model: ${connection.modelId ?? 'bot default'}`,
    '',
    'Type your first message.',
  ]
  if (previousTitle) {
    lines.push(
      `↩ Previous: "${truncate(previousTitle, 40)}" — /list to return.`,
    )
  }
  await thread.post(lines.join('\n'))
}

export async function cmdArchive(
  db: DB,
  connection: TelegramConnection,
  thread: Thread,
  telegramChatId: string,
  nArg: string,
): Promise<void> {
  const target = await resolveArchiveTarget(
    db,
    connection,
    telegramChatId,
    nArg,
    thread,
  )
  if (!target) return

  const now = new Date()
  await db
    .update(conversations)
    .set({ archivedAt: now, updatedAt: now })
    .where(eq(conversations.id, target.id))
    .run()
  // No need to clear the active pointer manually — resolveConversationId
  // filters by archivedAt IS NULL, so an active row pointing at the
  // archived conversation simply falls through to the fallback chain.
  await thread.post(
    `🗄 Archived "${truncate(target.title, 50)}"\n\n` +
      '↩ /unarchive to restore (within the next 24h).',
  )
}

// Resolves what /archive [n] is operating on. With no arg, archives
// the active. With an arg, uses the 1-based position in /list. Posts
// the user-facing error directly when validation fails and returns
// null so the caller bails.
async function resolveArchiveTarget(
  db: DB,
  connection: TelegramConnection,
  telegramChatId: string,
  nArg: string,
  thread: Thread,
): Promise<{ id: string; title: string } | null> {
  if (nArg.trim() === '') {
    const id = await findActiveConversationId(db, connection, telegramChatId)
    if (!id) {
      await thread.post(
        'No active conversation to archive.\n/list to see options.',
      )
      return null
    }
    const row = await db
      .select({ title: conversations.title })
      .from(conversations)
      .where(eq(conversations.id, id))
      .get()
    return { id, title: row?.title ?? 'Untitled' }
  }
  const n = Number.parseInt(nArg, 10)
  if (!Number.isFinite(n) || n < 1) {
    await thread.post(
      'Usage: /archive [number]\nLeave the number off to archive the active one.',
    )
    return null
  }
  const items = await listConversationsForChat(db, connection, telegramChatId)
  if (n > items.length) {
    await thread.post(
      `${n} is out of range. You have ${items.length} conversation${
        items.length === 1 ? '' : 's'
      }.`,
    )
    return null
  }
  const target = items[n - 1]
  if (!target) return null
  return { id: target.conversationId, title: target.title }
}

export async function cmdUnarchive(
  db: DB,
  connection: TelegramConnection,
  thread: Thread,
  telegramChatId: string,
): Promise<void> {
  // Most-recently-archived conversation reachable from this (bot, chat).
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const row = await db
    .selectDistinct({
      conversationId: conversations.id,
      title: conversations.title,
      archivedAt: conversations.archivedAt,
    })
    .from(conversations)
    .innerJoin(
      telegramChats,
      eq(telegramChats.conversationId, conversations.id),
    )
    .where(
      and(
        eq(telegramChats.connectionId, connection.id),
        eq(telegramChats.telegramChatId, telegramChatId),
        isNotNull(conversations.archivedAt),
      ),
    )
    .orderBy(desc(conversations.archivedAt))
    .get()
  if (!row?.archivedAt || row.archivedAt < cutoff) {
    await thread.post(
      'Nothing to unarchive within the last 24h.\nOlder archives can be restored from the desktop app.',
    )
    return
  }
  const now = new Date()
  await db
    .update(conversations)
    .set({ archivedAt: null, updatedAt: now })
    .where(eq(conversations.id, row.conversationId))
    .run()
  await thread.post(
    `↩ Restored "${truncate(row.title, 50)}"\n\n/switch to it via /list.`,
  )
}
