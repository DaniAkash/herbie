import { Hono } from 'hono'
import { getTaskResultCapture } from '../tasks/task-result-capture'
import { consumePendingIntent } from '../tray/intent'

// Loopback-only endpoints for processes Herbie itself spawns.
// `Bun.serve({ hostname: '127.0.0.1' })` in src/bun/index.ts keeps
// these unreachable from the network; the per-run token is a second
// line of defence against another local process guessing the URL.
//
// Right now the only consumer is the herbie__task_result MCP child;
// keep this file scoped to that pattern (spawn-time-token → POST →
// in-memory capture).

// Reject markdown larger than the renderer can usefully display;
// also prevents a malicious child from filling the row with garbage.
const MAX_MARKDOWN_BYTES = 256_000

export const internalRoute = new Hono()
  .post('/internal/task-result/:token', async (c) => {
    const token = c.req.param('token')
    const body = (await c.req.json().catch(() => null)) as {
      markdown?: unknown
    } | null
    const markdown = typeof body?.markdown === 'string' ? body.markdown : null
    if (!markdown || markdown.trim() === '') {
      return c.json({ error: 'markdown required' }, 400)
    }
    if (markdown.length > MAX_MARKDOWN_BYTES) {
      return c.json({ error: 'markdown too large' }, 413)
    }
    const accepted = getTaskResultCapture().receive(token, markdown)
    if (!accepted) {
      // Unknown / used / disposed token — treat as not-found so the
      // child sees a stable failure shape.
      return c.json({ error: 'not found' }, 404)
    }
    return c.json({ ok: true })
  })
  // Tray click → bun → renderer navigation hop. The renderer polls
  // this while visible and navigates whenever it sees a non-null
  // body. The intent is consumed (cleared) on read so the next poll
  // is a no-op until another tray click writes a new one.
  .get('/internal/tray-intent', (c) => {
    const intent = consumePendingIntent()
    return c.json(intent ?? null)
  })
