import type { Tray } from 'electrobun/bun'
import type { DB } from '../../db'
import { refreshTray } from './tray-menu'

// Singleton wrapper around the tray instance + DB so callsites
// outside src/bun/index.ts (the Hono middleware, the Telegram bridge)
// don't need to thread the tray object through their call stacks.
// The refresh() entrypoint debounces with a 250ms trailing-edge timer
// so a burst of mutations collapses to one setMenu call.

const DEBOUNCE_MS = 250

interface TrayBinding {
  refresh: () => void
}

let binding: TrayBinding | null = null

export function initTrayBinding(tray: Tray, db: DB): TrayBinding {
  let pending: ReturnType<typeof setTimeout> | null = null
  const refresh = (): void => {
    if (pending) return
    pending = setTimeout(() => {
      pending = null
      void refreshTray(tray, db).catch((err: unknown) => {
        // biome-ignore lint/suspicious/noConsole: dev-debug surface
        console.error('[tray] refresh failed:', err)
      })
    }, DEBOUNCE_MS)
  }
  binding = { refresh }
  return binding
}

export function getTrayBinding(): TrayBinding {
  // No tray (e.g. headless tests, future non-macOS builds): treat as
  // a no-op so the middleware + bridge don't crash.
  if (!binding) return { refresh: () => {} }
  return binding
}
