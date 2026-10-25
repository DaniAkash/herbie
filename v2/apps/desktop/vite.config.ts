import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * Where the sidecar is, for the browser build.
 *
 * The desktop build asks the shell, which knows the port it handed the
 * sidecar. A browser has nobody to ask, so it uses the port the sidecar
 * listens on when nothing spawned it and lets an env var override.
 */
const API_TARGET = process.env.HERBIE_API_URL ?? 'http://127.0.0.1:4576'
const API_TOKEN = process.env.HERBIE_API_TOKEN

export default defineConfig({
  plugins: [
    tanstackRouter(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(here, './src'),
      '@bun': path.resolve(here, './src-bun'),
    },
  },
  // Tauri expects a fixed port and surfaces rust errors rather than hiding them.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      /**
       * The sidecar, reached same origin.
       *
       * Without this the page would call 127.0.0.1 from localhost, which is
       * cross origin, so a server that can drive coding agents would have to
       * send CORS headers to a browser. Proxying keeps that surface shut.
       *
       * The proxy is also where the token belongs when one is set. It runs in
       * node, not in the page, so the secret stays out of the browser exactly
       * as it stays out of the webview in the desktop build.
       */
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        ws: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (request) => {
            if (API_TOKEN !== undefined) {
              request.setHeader('authorization', `Bearer ${API_TOKEN}`)
            }
          })
        },
      },
    },
    fs: {
      // The isolated linker keeps packages in bun's global store rather than
      // inside the project, so font files resolve to paths outside the root
      // and Vite refuses to serve them. Allowing the store is what makes the
      // shared install work in dev; without it the app renders in fallback
      // fonts and the console fills with denials.
      allow: [
        searchForWorkspaceRoot(here),
        path.join(homedir(), '.bun', 'install', 'cache'),
      ],
    },
  },
})
