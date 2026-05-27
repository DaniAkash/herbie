import type { Tray } from 'electrobun/bun'
import type { DB } from '../../db'
import {
  basenameOrNull,
  formatBadge,
  formatLabel,
  truncate,
} from './tray-menu.format'
import {
  type ChatRow,
  countChatUnread,
  countInboxUnread,
  fetchRecentChats,
  fetchRecentInbox,
  fetchRecentTaskRuns,
  fetchTelegramBots,
  type InboxRow,
  type TaskRunRow,
  type TelegramBotRow,
  TOP_LIMIT,
} from './tray-menu.queries'

// Menu shape:
//   Inbox          (top 3 + More)
//   Telegram       (top 3 bots + More) — one row per bot, sidebar parity
//   Chats          (top 3 + More)
//   New Chat / Tasks
//   Open / Quit
// Sections with zero data hide entirely so a fresh install just sees
// the bottom four rows.

// Electrobun MenuItemConfig is defined in proc/native.ts but isn't
// re-exported cleanly. Local mirror matches the runtime shape; the
// FFI serializer accepts anything structurally compatible.
type MenuConfig =
  | { type: 'divider' | 'separator' }
  | {
      type: 'normal'
      label: string
      action?: string
      data?: unknown
      submenu?: MenuConfig[]
      enabled?: boolean
      tooltip?: string
    }

export async function refreshTray(tray: Tray, db: DB): Promise<void> {
  const [
    inboxItemsList,
    inboxUnread,
    telegramBots,
    recentChats,
    chatUnread,
    recentTaskRuns,
  ] = await Promise.all([
    fetchRecentInbox(db),
    countInboxUnread(db),
    fetchTelegramBots(db),
    fetchRecentChats(db),
    countChatUnread(db),
    fetchRecentTaskRuns(db),
  ])

  const telegramUnreadTotal = telegramBots.reduce(
    (n, b) => n + b.unreadCount,
    0,
  )

  tray.setTitle(formatBadge(inboxUnread + telegramUnreadTotal + chatUnread))
  tray.setMenu(
    buildMenu({
      inboxItemsList,
      inboxUnread,
      telegramBots,
      recentChats,
      recentTaskRuns,
    }),
  )
}

function buildMenu(input: {
  inboxItemsList: InboxRow[]
  inboxUnread: number
  telegramBots: TelegramBotRow[]
  recentChats: ChatRow[]
  recentTaskRuns: TaskRunRow[]
}): MenuConfig[] {
  const items: MenuConfig[] = []
  appendInboxSection(items, input.inboxItemsList, input.inboxUnread)
  appendTelegramSection(items, input.telegramBots)
  appendChatsSection(items, input.recentChats)
  appendTasksSection(items, input.recentTaskRuns)

  // Quick actions are always present.
  items.push({ type: 'divider' })
  items.push({ type: 'normal', label: '+ New Chat', action: 'new-chat' })
  items.push({ type: 'normal', label: 'Tasks', action: 'open-tasks' })
  items.push({ type: 'divider' })
  items.push({ type: 'normal', label: 'Open Herbie', action: 'open' })
  items.push({ type: 'normal', label: 'Quit Herbie', action: 'quit' })

  return items
}

function appendInboxSection(
  items: MenuConfig[],
  rows: InboxRow[],
  unread: number,
): void {
  if (rows.length === 0) return
  items.push({
    type: 'normal',
    label: unread > 0 ? `Inbox (${unread})` : 'Inbox',
    enabled: false,
  })
  for (const row of rows.slice(0, TOP_LIMIT)) {
    items.push(inboxItemMenu(row))
  }
  const more = rows.slice(TOP_LIMIT)
  if (more.length > 0) {
    const submenu: MenuConfig[] = more.map(inboxItemMenu)
    submenu.push({ type: 'divider' })
    submenu.push({ type: 'normal', label: 'Open Inbox', action: 'open-inbox' })
    items.push({ type: 'normal', label: 'More', submenu })
  } else {
    items.push({ type: 'normal', label: 'Open Inbox', action: 'open-inbox' })
  }
  items.push({ type: 'divider' })
}

function inboxItemMenu(row: InboxRow): MenuConfig {
  return {
    type: 'normal',
    label: formatLabel(row.taskName, basenameOrNull(row.workspacePath)),
    action: 'open-inbox-item',
    data: { id: row.id },
  }
}

function appendTelegramSection(
  items: MenuConfig[],
  bots: TelegramBotRow[],
): void {
  if (bots.length === 0) return
  const unread = bots.reduce((n, b) => n + b.unreadCount, 0)
  items.push({
    type: 'normal',
    label: unread > 0 ? `Telegram (${unread})` : 'Telegram',
    enabled: false,
  })
  for (const bot of bots.slice(0, TOP_LIMIT)) items.push(botMenuItem(bot))
  const more = bots.slice(TOP_LIMIT)
  if (more.length > 0) {
    const submenu: MenuConfig[] = more.map(botMenuItem)
    submenu.push({ type: 'divider' })
    submenu.push({
      type: 'normal',
      label: 'Open Settings → Mobile',
      action: 'open-mobile-settings',
    })
    items.push({ type: 'normal', label: 'More', submenu })
  } else {
    items.push({
      type: 'normal',
      label: 'Open Settings → Mobile',
      action: 'open-mobile-settings',
    })
  }
  items.push({ type: 'divider' })
}

// Single-chat bots → direct link. Multi-chat bots → submenu of their
// chats, matching the sidebar's MultiChatBotRow.
function botMenuItem(bot: TelegramBotRow): MenuConfig {
  const usernameLabel = bot.botUsername
    ? `@${bot.botUsername}`
    : bot.connectionName
  const suffix = bot.unreadCount > 0 ? ` (${bot.unreadCount})` : ''
  if (bot.chats.length === 1) {
    const chat = bot.chats[0]
    if (!chat) {
      return { type: 'normal', label: usernameLabel, enabled: false }
    }
    return {
      type: 'normal',
      label: `${usernameLabel}${suffix}`,
      action: 'open-conversation',
      data: { id: chat.conversationId },
    }
  }
  return {
    type: 'normal',
    label: `${usernameLabel}${suffix}`,
    submenu: bot.chats.map((chat) => {
      const chatLabel =
        chat.chatTitle ||
        chat.conversationTitle ||
        `chat ${chat.telegramChatId.slice(-6)}`
      const chatSuffix = chat.unreadCount > 0 ? ` (${chat.unreadCount})` : ''
      return {
        type: 'normal' as const,
        label: `${truncate(chatLabel, 55)}${chatSuffix}`,
        action: 'open-conversation',
        data: { id: chat.conversationId },
      }
    }),
  }
}

function appendChatsSection(items: MenuConfig[], rows: ChatRow[]): void {
  if (rows.length === 0) return
  items.push({ type: 'normal', label: 'Chats', enabled: false })
  for (const row of rows.slice(0, TOP_LIMIT)) items.push(chatItemMenu(row))
  const more = rows.slice(TOP_LIMIT)
  if (more.length > 0) {
    const submenu: MenuConfig[] = more.map(chatItemMenu)
    submenu.push({ type: 'divider' })
    submenu.push({ type: 'normal', label: 'Open Chats', action: 'open-chats' })
    items.push({ type: 'normal', label: 'More', submenu })
  }
}

function chatItemMenu(row: ChatRow): MenuConfig {
  const baseLabel = formatLabel(
    row.title || 'Untitled',
    basenameOrNull(row.workspacePath),
  )
  return {
    type: 'normal',
    // Leading dot is visible in NSMenu via Unicode; the macOS menu
    // renderer treats it as part of the label so we get a per-row
    // unread indicator without an icon asset.
    label: row.unread ? `• ${baseLabel}` : `  ${baseLabel}`,
    action: 'open-conversation',
    data: { id: row.id },
  }
}

function appendTasksSection(items: MenuConfig[], rows: TaskRunRow[]): void {
  if (rows.length === 0) return
  items.push({ type: 'normal', label: 'Recent tasks', enabled: false })
  for (const row of rows.slice(0, TOP_LIMIT)) items.push(taskRunMenu(row))
  const more = rows.slice(TOP_LIMIT)
  if (more.length > 0) {
    const submenu: MenuConfig[] = more.map(taskRunMenu)
    submenu.push({ type: 'divider' })
    submenu.push({ type: 'normal', label: 'Open Tasks', action: 'open-tasks' })
    items.push({ type: 'normal', label: 'More', submenu })
  }
}

function taskRunMenu(row: TaskRunRow): MenuConfig {
  const suffix =
    row.status === 'error'
      ? ' (failed)'
      : row.status === 'completed'
        ? ''
        : ` (${row.status})`
  return {
    type: 'normal',
    label: `${truncate(row.taskName, 45)}${suffix}`,
    // Click target chosen at render time: the inbox row is the row
    // that carries the run's deliverable; fall back to the task
    // editor for still-running rows where no inbox row exists yet.
    action: row.inboxItemId ? 'open-inbox-item' : 'open-task',
    data: { id: row.inboxItemId ?? row.taskId },
  }
}
