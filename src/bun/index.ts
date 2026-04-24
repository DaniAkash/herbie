import Electrobun, { BrowserWindow, Tray, Updater } from 'electrobun/bun'

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

// Hide dock icon — run as a true menubar-only app
Electrobun.app.setActivationPolicy('accessory')

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

// Intercept close → hide to tray instead of quitting
mainWindow.on('will-close', (e) => {
  e.preventDefault()
  mainWindow.hide()
})

// Tray click → toggle window visibility
tray.on('tray-clicked', () => {
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    mainWindow.show()
  }
})

tray.setMenu([
  { type: 'normal', label: 'Open Herbie', action: 'open' },
  { type: 'divider' },
  { type: 'normal', label: 'Quit', action: 'quit' },
])

tray.on('tray-menu-action', (e) => {
  if (e.data.action === 'open') {
    mainWindow.show()
  } else if (e.data.action === 'quit') {
    Electrobun.app.exit()
  }
})
