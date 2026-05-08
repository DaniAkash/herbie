import type { ElectrobunConfig } from 'electrobun'

export default {
  app: {
    name: 'Herbie',
    identifier: 'herbie.daniakash.com',
    version: '0.0.1',
  },
  build: {
    copy: {
      'dist/index.html': 'views/mainview/index.html',
      'dist/assets': 'views/mainview/assets',
      drizzle: 'drizzle',
    },
    watchIgnore: ['dist/**'],
    runtime: {
      // Herbie is a menubar-resident app — closing the window leaves the
      // app alive in the tray. The "Keep in menu bar on close" toggle in
      // Settings flips this dynamically by calling Utils.quit() from the
      // window's close handler when the toggle is off.
      exitOnLastWindowClosed: false,
    },
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig
