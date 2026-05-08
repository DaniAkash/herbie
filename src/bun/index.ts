import { eq } from 'drizzle-orm'
import { BrowserWindow, Tray, Updater, Utils } from 'electrobun/bun'
import { initializeDatabase } from '../db'
import {
  appSettings,
  SETTINGS_SINGLETON_ID,
} from '../db/schema/app-settings.sql'
import { setDb } from './db-singleton'
import { setLoginItem } from './loginItems'
import app from './server'
import { loadFrame, persistFrame, type WindowFrame } from './windowState'

const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`
const API_PORT = 4575

const { db } = await initializeDatabase()
setDb(db)

async function readSettings() {
  return db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_SINGLETON_ID))
    .get()
}

const bootSettings = await readSettings()
if (bootSettings) {
  // Reconcile the LaunchAgent state with what's in the DB at boot — the
  // user may have removed the plist manually, or this might be the first
  // boot after the toggle was set on a previous machine.
  await setLoginItem(bootSettings.launchAtLogin)
}

Bun.serve({ port: API_PORT, hostname: '127.0.0.1', fetch: app.fetch })

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
    void readSettings().then((row) => {
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
