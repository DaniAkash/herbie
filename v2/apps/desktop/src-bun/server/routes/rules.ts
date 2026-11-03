import { agentRules } from '@bun/modules/db/schema/schema'
import type { Deps } from '@bun/server/deps'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

/** Removing a rule only needs its own id; adding one belongs to its agent. */
export function rulesRoute(deps: Deps) {
  return new Hono().delete('/:id', (c) => {
    const row = deps.db
      .delete(agentRules)
      .where(eq(agentRules.id, c.req.param('id')))
      .returning()
      .get()
    if (!row) return c.json({ error: 'no such rule' }, 404)
    return c.json({ deleted: true })
  })
}
