import { eq } from 'drizzle-orm'
import Electrobun, { BrowserWindow, Tray, Updater, Utils } from 'electrobun/bun'
import { z } from 'zod'
import { initializeDatabase } from '../db'
import { conversations } from '../db/schema/conversations.sql'
import { settings as settingsTable } from '../db/schema/settings.sql'
import { setupApplicationMenu } from './applicationMenu'
import { recoverInterruptedTurns } from './chat/recovery'
import { getSessionManager } from './chat/sessionManager'
import { setDb } from './db-singleton'
import { setLoginItem } from './loginItems'
import app from './server'
import { loadFrame, persistFrame, type WindowFrame } from './windowState'
import {
  ensureDefaultWorkspace,
  migrateStaleCapabilities,
} from './workspaces/bootstrap'

const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`
const API_PORT = 4575

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

tray.on('tray-clicked', () => {
  if (mainWindow) {
    mainWindow.show()
  } else {
    mainWindow = createMainWindow()
  }
})

tray.setMenu([
  { type: 'normal', label: 'Open Herbie', action: 'open' },
  { type: 'divider' },
  { type: 'normal', label: 'Quit Herbie', action: 'quit' },
])

// Best-effort cleanup on quit. Electrobun's quit sequence emits this
// synchronously and won't await async listeners, but acpx persists session
// state to disk so a half-finished close still leaves resumable state for
// the next launch via resumeSessionId.
Electrobun.events.on('before-quit', () => {
  void shutdown()
})

async function shutdown(): Promise<void> {
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
