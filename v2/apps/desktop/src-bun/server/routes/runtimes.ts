import { listRuntimes, probeRuntime } from '@bun/modules/runtimes/runtimes'
import type { Deps } from '@bun/server/deps'
import { Hono } from 'hono'

/**
 * The coding agents an agent can run on.
 *
 * Listing detects; only the probe route spawns anything. Keeping the two
 * apart is what lets the new agent flow open instantly and fill in the model
 * rows a moment later.
 */
export function runtimesRoute(deps: Deps) {
  return new Hono()
    .get('/', async (c) => {
      return c.json({ runtimes: await listRuntimes(deps.db) })
    })
    .post('/:id/probe', async (c) => {
      const runtime = await probeRuntime(deps.db, c.req.param('id'))
      if (!runtime) return c.json({ error: 'no such runtime' }, 404)
      return c.json({ runtime })
    })
}
