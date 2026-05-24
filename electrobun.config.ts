import type { ElectrobunConfig } from 'electrobun'

// Release builds (CI) set ELECTROBUN_SIGN=1 to enable codesign + notarize.
// Local dev builds leave it unset so they don't try to talk to Apple.
//
// Electrobun's CLI has no --target flag — the only way to control which
// platform to build is via the `build.targets` config field. The matrix
// in .github/workflows/release.yml exports ELECTROBUN_TARGET per arch so
// the same one config file produces a per-arch DMG without per-matrix
// config edits.
//
// process.env (not Bun.env) because the standalone Electrobun CLI loads
// this file in a context where Bun.env didn't reliably surface the
// runner's env vars; biome's noProcessEnv rule is disabled for this one
// file via an override in biome.json (a build config IS the right place
// to read OS env, the rule exists for React/business code).
const SIGN = process.env.ELECTROBUN_SIGN === '1'
const TARGET = process.env.ELECTROBUN_TARGET ?? 'current'

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
    targets: TARGET,
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
      codesign: SIGN,
      notarize: SIGN,
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
