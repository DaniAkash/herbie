import { desc, eq } from 'drizzle-orm'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { conversations } from '../../db/schema/conversations.sql'
import { inboxItems } from '../../db/schema/inbox-items.sql'
import { taskRuns } from '../../db/schema/task-runs.sql'
import { tasks } from '../../db/schema/tasks.sql'
import { getDisplayMeta } from '../agents/agent-display'
import { getEventBus } from '../chat/eventBus'
import type { PersistedEvent } from '../chat/events.types'
import { getDb } from '../db-singleton'
import { readSettings } from '../routes/settings'
import { getCurrentFocus } from './focus-state'
import { notify, onNotificationClick } from './native'
import { onTaskFinalized, type TaskFinalizedEvent } from './task-watch'

// Notification body cap. Anything longer is sliced; renderer surfaces
// the full text once the user clicks through.
const BODY_PREVIEW_CHARS = 100

// Click actions carry enough metadata to deep-link into the right
// screen. We hold them in-memory for up to 30 minutes so a stale entry
// from a never-clicked notification does not leak.
const CLICK_TTL_MS = 30 * 60 * 1000

type ClickAction =
  | { type: 'open-chat'; conversationId: string }
  | { type: 'open-permission'; conversationId: string }
  // taskRunId is what we know at notification fire time. The inbox row
  // for this run is created by the scheduler right after writeFinalRow
  // emits, so resolving runId -> inboxItemId happens at click time.
  | { type: 'open-task'; taskRunId: string }

interface ClickEntry {
  action: ClickAction
  createdAt: number
}

const clickMap = new Map<string, ClickEntry>()

function rememberClick(id: string, action: ClickAction): void {
  clickMap.set(id, { action, createdAt: Date.now() })
  // Lazy sweep: drop entries older than the TTL. Keeps the map size
  // bounded without a setInterval.
  const cutoff = Date.now() - CLICK_TTL_MS
  for (const [k, v] of clickMap) {
    if (v.createdAt < cutoff) clickMap.delete(k)
  }
}

export interface DispatcherDeps {
  // Bun-side function that raises the main window and queues a
  // navigation intent for the renderer to pick up via the existing
  // /internal/tray-intent poller.
  navigateAndShow: (path: string) => void
}

let initialized = false

export function initNotificationDispatcher(deps: DispatcherDeps): void {
  if (initialized) return
  initialized = true

  onNotificationClick((id) => {
    const entry = clickMap.get(id)
    if (!entry) return
    clickMap.delete(id)
    switch (entry.action.type) {
      case 'open-chat':
      case 'open-permission':
        deps.navigateAndShow(`/chat/${entry.action.conversationId}`)
        return
      case 'open-task':
        void resolveAndOpenTask(entry.action.taskRunId, deps)
        return
    }
  })

  getEventBus().subscribeAll((event) => {
    void handleChatEvent(event).catch(() => undefined)
  })

  onTaskFinalized((event) => {
    void handleTaskFinalized(event).catch(() => undefined)
  })
}

async function handleChatEvent(event: PersistedEvent): Promise<void> {
  if (event.type !== 'turn.finish' && event.type !== 'permission.request') {
    return
  }
  const conv = await getDb()
    .select()
    .from(conversations)
    .where(eq(conversations.id, event.conversationId))
    .get()
  if (!conv) return
  // Telegram-origin chats never fire a Mac toast. The user already
  // follows them on Telegram and explicitly does not want the
  // duplicated context locally.
  if (conv.origin === 'telegram') return

  const focus = getCurrentFocus()
  const isFocused = focus.conversationId === conv.id

  if (event.type === 'turn.finish') {
    if (isFocused) {
      await getDb()
        .update(conversations)
        .set({ lastSeenAt: new Date() })
        .where(eq(conversations.id, conv.id))
        .run()
      return
    }
    const settings = await readSettings()
    if (!settings.general.notifications.agentActivity) return
    const body = await loadTurnPreview(conv.id, event)
    const display = getDisplayMeta(conv.agentId)
    const notificationId = `chat:${conv.id}:${nowToken()}`
    rememberClick(notificationId, {
      type: 'open-chat',
      conversationId: conv.id,
    })
    notify({
      id: notificationId,
      title: `${display.displayName} replied`,
      body: body ?? conv.title,
      silent: !settings.general.notifications.sound,
      category: 'chat-reply',
    })
    return
  }

  // permission.request
  if (isFocused) return
  const settings = await readSettings()
  if (!settings.general.notifications.agentActivity) return
  const payload = event.payload as { toolName?: string; requestId?: string }
  const display = getDisplayMeta(conv.agentId)
  const notificationId = `perm:${payload.requestId ?? nowToken()}`
  rememberClick(notificationId, {
    type: 'open-permission',
    conversationId: conv.id,
  })
  notify({
    id: notificationId,
    title: `${display.displayName} needs permission`,
    body: `Allow ${payload.toolName ?? 'tool'}?`,
    silent: !settings.general.notifications.sound,
    category: 'chat-permission',
  })
}

async function handleTaskFinalized(event: TaskFinalizedEvent): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: breadcrumb for diagnosing missing task toasts
  console.log('[notify] task-finalized received', event)
  const row = await getDb()
    .select({
      run: taskRuns,
      taskName: tasks.name,
    })
    .from(taskRuns)
    .innerJoin(tasks, eq(tasks.id, taskRuns.taskId))
    .where(eq(taskRuns.id, event.runId))
    .get()
  if (!row) {
    // biome-ignore lint/suspicious/noConsole: breadcrumb
    console.log('[notify] task run row missing at fire time', event.runId)
    return
  }
  const { run, taskName } = row
  const settings = await readSettings()
  if (!settings.general.notifications.taskResults) {
    // biome-ignore lint/suspicious/noConsole: breadcrumb
    console.log('[notify] taskResults toggle is off; skipping')
    return
  }
  const succeeded = event.status === 'completed'
  // Successful tool-delivery runs populate resultMarkdown and leave
  // resultText null (output_source='tool'). Read both in priority
  // order, fall back to the error string, and finally a stub so the
  // notify call never lands on an empty message (node-notifier
  // throws on empty body strings).
  const preview =
    run.resultMarkdown ?? run.resultText ?? run.errorMessage ?? null
  const body = preview
    ? truncate(preview, BODY_PREVIEW_CHARS)
    : succeeded
      ? 'Task completed.'
      : 'Task failed.'
  const notificationId = `task:${run.id}`
  rememberClick(notificationId, { type: 'open-task', taskRunId: run.id })
  notify({
    id: notificationId,
    title: `${taskName} ${succeeded ? 'done' : 'failed'}`,
    body,
    silent: !settings.general.notifications.sound,
    category: 'task',
  })
}

async function loadTurnPreview(
  conversationId: string,
  event: PersistedEvent,
): Promise<string | null> {
  // turn.finish payload doesn't carry the reply text. Pull the most
  // recent assistant.text event for this turn.
  const payload = event.payload as { requestId?: string }
  const requestId = payload.requestId
  const rows = await getDb()
    .select()
    .from(chatEvents)
    .where(eq(chatEvents.conversationId, conversationId))
    .orderBy(desc(chatEvents.seq))
    .limit(50)
    .all()
  for (const row of rows) {
    if (row.type !== 'assistant.text') continue
    try {
      const p = JSON.parse(row.payload) as {
        requestId?: string
        text?: string
      }
      if (requestId && p.requestId !== requestId) continue
      if (typeof p.text === 'string' && p.text.length > 0) {
        return truncate(p.text, BODY_PREVIEW_CHARS)
      }
    } catch {}
  }
  return null
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

let tokenCounter = 0
function nowToken(): string {
  tokenCounter += 1
  return `${Date.now().toString(36)}-${tokenCounter.toString(36)}`
}

// The inbox row carries the actual deliverable for a scheduled run.
// Scheduler creates it right after writeFinalRow emits, so by the time
// the user clicks the toast (seconds to minutes later) the row exists.
// Fall back to the tasks index if the lookup misses (e.g. the user
// rapid-clicked the toast inside the few-ms write race).
async function resolveAndOpenTask(
  taskRunId: string,
  deps: DispatcherDeps,
): Promise<void> {
  const row = await getDb()
    .select({ id: inboxItems.id })
    .from(inboxItems)
    .where(eq(inboxItems.taskRunId, taskRunId))
    .get()
  if (row) {
    deps.navigateAndShow(`/inbox/${row.id}`)
    return
  }
  deps.navigateAndShow('/tasks')
}
