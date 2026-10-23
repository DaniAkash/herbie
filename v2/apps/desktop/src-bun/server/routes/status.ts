import { agents } from '@bun/modules/db/schema/schema'
import type { Deps } from '@bun/server/deps'
import { count } from 'drizzle-orm'
import { Hono } from 'hono'

/**
 * What the window shows to prove the whole chain is live.
 *
 * Every field here is read at request time rather than captured at boot, so a
 * stale answer means the sidecar is wedged rather than that the numbers are
 * cached.
 */
export function statusRoute(deps: Deps) {
  return new Hono().get('/', (c) => {
    const agentCount =
      deps.db.select({ value: count() }).from(agents).get()?.value ?? 0
    return c.json({
      pid: process.pid,
      uptimeMs: Date.now() - deps.startedAt,
      databasePath: deps.databasePath,
      migrations: deps.appliedMigrations,
      agentCount,
    })
  })
}
