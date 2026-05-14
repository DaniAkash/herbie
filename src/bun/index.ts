import { eq } from 'drizzle-orm'
import Electrobun, { BrowserWindow, Tray, Updater, Utils } from 'electrobun/bun'
import { z } from 'zod'
import { initializeDatabase } from '../db'
import { conversations } from '../db/schema/conversations.sql'
import { settings as settingsTable } from '../db/schema/settings.sql'
import { API_PORT } from './api-port'
import { setupApplicationMenu } from './applicationMenu'
import { recoverInterruptedTurns } from './chat/recovery'
import { getSessionManager } from './chat/sessionManager'
import { setDb } from './db-singleton'
import { setLoginItem } from './loginItems'
import app from './server'
import { recoverInterruptedRuns } from './tasks/recovery'
import { getTaskScheduler } from './tasks/scheduler'
import { getTelegramManager } from './telegram/manager'
import { initTrayBinding } from './tray/binding'
import { setPendingIntent } from './tray/intent'
import { refreshTray } from './tray/tray-menu'
import { loadFrame, persistFrame, type WindowFrame } from './windowState'
import {
  ensureDefaultWorkspace,
  migrateStaleCapabilities,
} from './workspaces/bootstrap'

const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`

const { db } = await initializeDatabase()
setDb(db)

// macOS-only for now — the menu definition assumes the NSResponder-chain
// model. Win/Linux menus will need their own shape when those targets
// actually ship; revisit this guard then.
if (process.platform === 'darwin') setupApplicationMenu()

const generalDefaults = { launchAtLogin: false, minimizeToMenubarOnClose: true }
const generalSchema = z.object({
  launchAtLogin: z.boolean(),
  minimizeToMenubarOnClose: z.boolean(),
})
type GeneralSettings = z.infer<typeof generalSchema>

async function readGeneralSettings(): Promise<GeneralSettings> {
  const row = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, 'general'))
    .get()
  if (!row) return generalDefaults
  try {
    const merged = { ...generalDefaults, ...JSON.parse(row.value) }
    return generalSchema.parse(merged)
  } catch {
    return generalDefaults
  }
}

// Always reconcile the LaunchAgent — if the row is missing/corrupt, default
// to disabled so a stale plist from a previous install doesn't linger.
const bootGeneral = await readGeneralSettings()
await setLoginItem(bootGeneral.launchAtLogin)

// First-boot guard: ensure the default workspace directory and KV row are
// present. Idempotent on subsequent boots.
await ensureDefaultWorkspace()

// One-shot cleanup for a stale claude.reasoning entry shipped in an
// earlier build. Idempotent.
await migrateStaleCapabilities()

// Close any conversation whose event log shows a turn.start with no
// matching terminal event (hard crash mid-stream, pre-fix builds, etc).
// Synthesizes a turn.cancel + flips status to idle so the renderer
// doesn't render the conversation as streaming forever.
await recoverInterruptedTurns(db)

// Same idea for task_runs: any row left at status='running' from a
// previous bun process needs a synthetic turn.cancel + status flip so
// the renderer doesn't render a phantom streaming message.
await recoverInterruptedRuns(db)

// Boot the task scheduler — registers a Cron job per active task and
// applies the per-kind catch-up policy for runs missed while the app
// was quit. Idempotent: stop() runs in the shutdown handler.
const taskScheduler = getTaskScheduler(db)
await taskScheduler.start()

// Spin up the bot polling loop for every active telegram_connections
// row. Errors per-row are swallowed and persisted as
// telegramConnections.lastError so a single bad token doesn't block
// boot.
const telegramManager = getTelegramManager()
await telegramManager.startAll()

// idleTimeout: 0 disables Bun's per-connection 10s reaper. SSE chat streams
// can sit idle for minutes during a long agent thinking pause; the default
// would close them mid-turn.
Bun.serve({
  port: API_PORT,
  hostname: '127.0.0.1',
  idleTimeout: 0,
  fetch: app.fetch,
})

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel()
  if (channel === 'dev') {
    try {
      await fetch(DEV_SERVER_URL, { method: 'HEAD' })
      return DEV_SERVER_URL
    } catch {
      // Fall back to bundled view when Vite dev server is not running
    }
  }
  return 'views://mainview/index.html'
}

const tray = new Tray({
  title: 'Herbie',
  image: 'views://mainview/assets/icon-template.png',
  template: true,
  width: 22,
  height: 22,
})

const initialFrame = await loadFrame()
const url = await getMainViewUrl()

let currentFrame: WindowFrame = { ...initialFrame }
let mainWindow: BrowserWindow | null = null

type WindowEvent<T> = { data: T }

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: 'Herbie',
    url,
    titleBarStyle: 'hiddenInset',
    frame: currentFrame,
  })

  win.on('resize', (event) => {
    const data = (
      event as WindowEvent<{
        x: number
        y: number
        width: number
        height: number
      }>
    ).data
    currentFrame = {
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
    }
    persistFrame(currentFrame)
  })

  win.on('move', (event) => {
    const data = (event as WindowEvent<{ x: number; y: number }>).data
    currentFrame = { ...currentFrame, x: data.x, y: data.y }
    persistFrame(currentFrame)
  })

  win.on('close', () => {
    mainWindow = null
    void readGeneralSettings().then((row) => {
      if (row && row.minimizeToMenubarOnClose === false) {
        Utils.quit()
      }
    })
  })

  return win
}

mainWindow = createMainWindow()

function showMainWindow(): void {
  if (mainWindow) {
    mainWindow.show()
  } else {
    mainWindow = createMainWindow()
  }
}

// Single handler dispatches both bare-icon clicks (no action) and
// menu-item clicks (action set by setMenu config). For navigation
// targets we stash a pending intent that the renderer picks up via
// GET /internal/tray-intent on focus / interval.
//
// Electrobun wraps the payload in an ElectrobunEvent: the actual
// `{ id, action, data }` lives at `event.data`, not on the event
// object itself. Reading `event.action` directly returns undefined
// and every menu click silently falls through to the default.
tray.on('tray-clicked', (event) => {
  const evt = event as {
    data?: { action?: string; data?: { id?: string } | null }
  } | null
  const action = evt?.data?.action ?? ''
  const data = evt?.data?.data ?? null

  switch (action) {
    case 'quit':
      Utils.quit()
      return
    case 'new-chat':
      setPendingIntent('/chat/new')
      break
    case 'open-inbox':
      setPendingIntent('/inbox')
      break
    case 'open-chats':
      setPendingIntent('/')
      break
    case 'open-mobile-settings':
      setPendingIntent('/settings/mobile')
      break
    case 'open-tasks':
      setPendingIntent('/tasks')
      break
    case 'open-inbox-item':
      if (data?.id) setPendingIntent(`/inbox/${data.id}`)
      break
    case 'open-conversation':
      if (data?.id) setPendingIntent(`/chat/${data.id}`)
      break
    // 'open', '', or anything unknown — just show the window
    default:
      break
  }
  showMainWindow()
})

// Build the initial menu + badge, then register a binding so the
// Hono refresh middleware and the Telegram bridge can request
// debounced rebuilds without threading the tray object around.
await refreshTray(tray, db)
initTrayBinding(tray, db)

// 5s safety-net poll. Middleware + bridge refresh covers the common
// paths; this catches state changes that bypass both (e.g. scheduled
// task fires writing inbox rows directly from the run manager).
const TRAY_REFRESH_INTERVAL_MS = 5000
setInterval(() => {
  void refreshTray(tray, db).catch((err: unknown) => {
    // biome-ignore lint/suspicious/noConsole: tray refresh failures are dev-debug only
    console.error('[tray] interval refresh failed:', err)
  })
}, TRAY_REFRESH_INTERVAL_MS)

// Best-effort cleanup on quit. Electrobun's quit sequence emits this
// synchronously and won't await async listeners, but acpx persists session
// state to disk so a half-finished close still leaves resumable state for
// the next launch via resumeSessionId.
Electrobun.events.on('before-quit', () => {
  void shutdown()
})

async function shutdown(): Promise<void> {
  // Stop all cron jobs so no in-flight fire interleaves with the
  // shutdown writes below.
  taskScheduler.stop()
  await telegramManager.stopAll()
  // Flip any in-flight conversations back to idle so the UI doesn't render
  // them stuck on 'streaming' next launch.
  await db
    .update(conversations)
    .set({ status: 'idle', updatedAt: new Date() })
    .where(eq(conversations.status, 'streaming'))
    .run()
    .catch(() => {})
  await getSessionManager().disposeAll()
}
