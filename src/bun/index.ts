import { BrowserWindow, Tray, Updater } from 'electrobun/bun'
import { initializeDatabase } from '../db'
import { setDb } from './db-singleton'
import app from './server'
import { loadFrame, persistFrame } from './windowState'

const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`
const API_PORT = 4575

const { db } = await initializeDatabase()
setDb(db)
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

const url = await getMainViewUrl()

const initialFrame = await loadFrame()

const mainWindow = new BrowserWindow({
  title: 'Herbie',
  url,
  titleBarStyle: 'hiddenInset',
  frame: initialFrame,
})

type WindowEvent<T> = { data: T }
let currentFrame = { ...initialFrame }

mainWindow.on('resize', (event) => {
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

mainWindow.on('move', (event) => {
  const data = (event as WindowEvent<{ x: number; y: number }>).data
  currentFrame = { ...currentFrame, x: data.x, y: data.y }
  persistFrame(currentFrame)
})

// Track whether window is currently shown
let isWindowShown = true

// Tray click → toggle window
tray.on('tray-clicked', () => {
  if (isWindowShown) {
    mainWindow.minimize()
    isWindowShown = false
  } else {
    mainWindow.show()
    isWindowShown = true
  }
})

// Tray menu: Open + Quit
// Note: menu item actions are handled natively by Electrobun.
// "Open Herbie" re-shows the window via tray-clicked convention.
tray.setMenu([
  { type: 'normal', label: 'Open Herbie', action: 'open' },
  { type: 'divider' },
  { type: 'normal', label: 'Quit Herbie', action: 'quit' },
])

void mainWindow
