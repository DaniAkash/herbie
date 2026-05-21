import type { Thread } from 'chat'
import { eq } from 'drizzle-orm'
import type { DB } from '../../db'
import { conversations } from '../../db/schema/conversations.sql'
import type { TelegramConnection } from '../../db/schema/telegram-connections.sql'
import { formatRecency, truncate } from './commands.format'
import {
  findActiveConversationId,
  listConversationsForChat,
} from './commands.queries'

// /help and /start. Replies vary by bot kind so first-time users
// learn what surface they're interacting with.
export async function cmdHelp(
  connection: TelegramConnection,
  thread: Thread,
): Promise<void> {
  if (connection.kind === 'remote_control') {
    await thread.post(
      [
        '🤖 Herbie commands',
        '',
        '/new [title] — start a new conversation',
        '/list — show all conversations',
        '/switch <n> — switch active conversation',
        '/current — show the active one',
        '/archive [n] — archive a conversation',
        '/unarchive — restore the most recently archived (within 24h)',
        '/help — this list',
        '',
        'Plain text goes to the active conversation.',
      ].join('\n'),
    )
    return
  }
  await thread.post(
    [
      '🤖 Dedicated bot',
      '',
      'This bot is linked to a single conversation in the Herbie',
      'desktop app. Every message you send here goes to that',
      'conversation, and replies stream back here.',
      '',
      'To re-link this bot to a different conversation, use',
      '"Send to Telegram" in the Herbie desktop app.',
    ].join('\n'),
  )
}

// Polite redirect when a management command is sent to a
// special-purpose bot. Telling the user up front beats silently
// dropping the message.
export async function cmdRedirectSpecialPurpose(
  thread: Thread,
  name: string,
): Promise<void> {
  await thread.post(
    [
      `/${name} only works on a Remote Control bot.`,
      '',
      'This bot is dedicated to a single conversation. To manage',
      'many conversations from one bot, set up a Remote Control bot',
      'in the Herbie desktop app (Settings → Mobile).',
    ].join('\n'),
  )
}

export async function cmdUnknown(thread: Thread, name: string): Promise<void> {
  await thread.post(
    `Unknown command: /${name}\n\nType /help for the full list.`,
  )
}

export async function cmdList(
  db: DB,
  connection: TelegramConnection,
  thread: Thread,
  telegramChatId: string,
): Promise<void> {
  const items = await listConversationsForChat(db, connection, telegramChatId)
  if (items.length === 0) {
    await thread.post(
      'No conversations yet. Send any message to start one, or /new [title].',
    )
    return
  }
  const activeId = await findActiveConversationId(
    db,
    connection,
    telegramChatId,
  )
  const lines: string[] = [`📋 Your conversations (${items.length})`, '']
  items.forEach((item, idx) => {
    const n = idx + 1
    const tail =
      item.conversationId === activeId ? '→ now' : formatRecency(item.updatedAt)
    lines.push(`  ${n} · ${truncate(item.title, 40)}  ${tail}`)
  })
  lines.push('')
  lines.push('/switch <n> to switch')
  lines.push('/new [title] to create  ·  /archive <n> to archive')
  await thread.post(lines.join('\n'))
}

export async function cmdCurrent(
  db: DB,
  connection: TelegramConnection,
  thread: Thread,
  telegramChatId: string,
): Promise<void> {
  const activeId = await findActiveConversationId(
    db,
    connection,
    telegramChatId,
  )
  if (!activeId) {
    await thread.post(
      'No active conversation. Send any message to start one, or /new [title].',
    )
    return
  }
  const conv = await db
    .select({
      title: conversations.title,
      modelId: conversations.modelId,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.id, activeId))
    .get()
  if (!conv) {
    await thread.post('No active conversation. Send any message to start one.')
    return
  }
  await thread.post(
    [
      `💬 Active: "${truncate(conv.title, 50)}"`,
      `   Model: ${conv.modelId ?? 'bot default'}`,
      `   Last message: ${formatRecency(conv.updatedAt)}`,
      '',
      '/list to see all',
    ].join('\n'),
  )
}
