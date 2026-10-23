import { agents } from '@bun/modules/db/schema/schema'
import type { Deps } from '@bun/server/deps'
import { asc } from 'drizzle-orm'
import { Hono } from 'hono'

export function agentsRoute(deps: Deps) {
  return new Hono().get('/', (c) => {
    const rows = deps.db
      .select()
      .from(agents)
      .orderBy(asc(agents.createdAt))
      .all()
    return c.json({ agents: rows })
  })
}
