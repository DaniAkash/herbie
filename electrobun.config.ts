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
