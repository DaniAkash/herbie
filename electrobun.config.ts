import type { ElectrobunConfig } from 'electrobun'

export default {
  app: {
    name: 'Herbie',
    identifier: 'herbie.daniakash.com',
    version: '0.0.1',
  },
  runtime: {
    // Herbie is a menubar-resident app — closing the window leaves the
    // app alive in the tray. The "Keep in menu bar on close" toggle in
    // Settings flips this dynamically by calling Utils.quit() from the
    // window's close handler when the toggle is off.
    exitOnLastWindowClosed: false,
  },
  build: {
    copy: {
      'dist/index.html': 'views/mainview/index.html',
      'dist/assets': 'views/mainview/assets',
      drizzle: 'drizzle',
      // The herbie__task_result MCP child is spawned per scheduled run
      // by the agent (via acpx). It runs as a bun script next to the
      // bundled bun executable; the spec builder resolves the path
      // from `process.execPath`.
      'src/bun/tasks/mcp-task-result': 'mcp-task-result',
    },
    watchIgnore: ['dist/**'],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
      icon: 'icon.iconset/icon_512x512.png',
    },
    win: {
      bundleCEF: false,
      // Electrobun auto-converts PNG → ICO at build time. Reusing one of
      // the iconset PNGs keeps icon files in a single directory.
      icon: 'icon.iconset/icon_512x512.png',
    },
  },
} satisfies ElectrobunConfig
