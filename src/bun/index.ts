import { BrowserWindow, Tray, Updater } from 'electrobun/bun'

const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`

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

const mainWindow = new BrowserWindow({
  title: 'Herbie',
  url,
  frame: {
    width: 380,
    height: 500,
    x: 200,
    y: 200,
  },
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
