import type { MiddlewareHandler } from 'hono'
import { getTrayBinding } from './binding'

// Fires getTrayBinding().refresh() after any non-GET 2xx so the tray
// menu re-renders without per-route plumbing. Skipped for reads
// (GET/HEAD) and failed mutations (4xx/5xx). The refresh itself is
// fire-and-forget — never blocks or rejects the response.
//
// One path this can't cover: chat-sdk's inbound Telegram handler
// runs outside the Hono request cycle. The bridge calls refresh()
// explicitly there.
export const trayRefreshMiddleware: MiddlewareHandler = async (c, next) => {
  await next()
  const method = c.req.method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return
  if (c.res.status >= 400) return
  getTrayBinding().refresh()
}
