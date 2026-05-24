import type { ElectrobunConfig } from 'electrobun'

// CI release builds set ELECTROBUN_SIGN=1 to enable codesign + notarize.
// Local dev leaves it unset; `electrobun dev --watch` (the dev script)
// goes through runDevWatch which never touches the signing code path
// regardless, but keeping these flags gated also keeps the `start`
// script (`vite build && electrobun dev`) safe — it runs runBuild in
// "dev" mode which respects the config.
//
// Bun.env, not process.env, so biome's noProcessEnv rule applies cleanly
// across the rest of the project. Bun.env is Bun's native env API and
// works identically inside the standalone Electrobun CLI's config loader.
const SIGN = Bun.env.ELECTROBUN_SIGN === '1'

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
      // @libsql/client loads its native binary via a runtime-computed
      // require pattern (require(`@libsql/${platform}-${arch}`)) that
      // Bun's bundler can't statically trace. The JS shim ends up in
      // index.js but the .node binary is dropped from the bundle, so
      // every fresh install crashes at startup with "Cannot find
      // module '@libsql/darwin-arm64'". Copy the matching platform
      // package into node_modules/ where Bun's CommonJS resolver finds
      // it relative to index.js. When x64 returns (electrobun#341),
      // add a sibling entry for @libsql/darwin-x64.
      'node_modules/@libsql/darwin-arm64':
        'bun/node_modules/@libsql/darwin-arm64',
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
