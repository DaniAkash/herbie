import { type Client, hcWithType } from '@bun/server/client'
import type { ApiInfo } from '@bun/shared/index'
import { invoke } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { isDesktop } from '@/modules/host/host'

let desktop: ApiInfo | null = null
let pending: Promise<ApiInfo> | null = null
let web: Client | null = null

/** Long enough that a cold sidecar is never mistaken for a dead one. */
const READY_TIMEOUT_MS = 20_000
const POLL_MS = 100

/**
 * Where the sidecar is listening, asked of the shell that spawned it.
 *
 * Neither value can be known ahead of time: the port is chosen by the OS when
 * the sidecar binds, and the token is fresh for each launch. `api_info` reads
 * the state the shell fills in when the sidecar reports, so until that lands
 * it answers with no port at all.
 *
 * The window is served by Vite and loads well before any of that, so this
 * waits rather than failing. The route loaders ask for data on first paint,
 * and a loader that rejects is terminal: the window would sit on its error
 * boundary for the rest of the launch over a gap of about a second.
 *
 * Several loaders ask at once, so they share one wait instead of each
 * starting a poll of its own.
 */
async function desktopInfo(): Promise<ApiInfo> {
  if (desktop?.port) return desktop
  pending ??= awaitSidecar().finally(() => {
    pending = null
  })
  return pending
}

async function awaitSidecar(): Promise<ApiInfo> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  for (;;) {
    const info = await invoke<ApiInfo>('api_info')
    if (info.port) {
      desktop = info
      return info
    }
    if (Date.now() >= deadline) {
      throw new Error('the sidecar never reported a port')
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

/**
 * The typed client, over whichever transport this host has.
 *
 * The two differ in more than a base URL, which is why this branches rather
 * than parameterising one path.
 *
 * In the desktop window the webview origin is never same origin with
 * 127.0.0.1, so a browser fetch would need permissive CORS on a server that
 * can drive coding agents. Going through Rust avoids needing any, and the port
 * and the per-launch token come from the shell that spawned the sidecar.
 *
 * On the web the page is served by Vite, which proxies `/api`. Requests are
 * same origin, so nothing needs CORS and nothing needs a port: the proxy holds
 * the address, and the token if there is one, so a secret is never handed to a
 * browser.
 */
export async function api(): Promise<Client> {
  if (!isDesktop()) {
    web ??= hcWithType('')
    return web
  }
  const { port, token } = await desktopInfo()
  return hcWithType(`http://127.0.0.1:${port}`, {
    fetch: tauriFetch as unknown as typeof fetch,
    headers: { authorization: `Bearer ${token}` },
  })
}
