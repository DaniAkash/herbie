import {
  agents,
  messages,
  routines,
} from '@bun/modules/db/schema/schema'
import type { Deps } from '@bun/server/deps'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

/**
 * Agents, their conversations and their routines.
 *
 * Chained rather than registered statement by statement, because Hono builds
 * the RPC types from the chain and a bare `app.route(...)` erases them.
 */
export function agentsRoute(deps: Deps) {
  return new Hono()
    .get('/', (c) => {
      const rows = deps.db
        .select()
        .from(agents)
        .orderBy(asc(agents.createdAt))
        .all()
      return c.json({ agents: rows })
    })
    .get('/:id', (c) => {
      const row = deps.db
        .select()
        .from(agents)
        .where(eq(agents.id, c.req.param('id')))
        .get()
      if (!row) return c.json({ error: 'no such agent' }, 404)
      return c.json({ agent: row })
    })
    .get('/:id/messages', (c) => {
      const rows = deps.db
        .select()
        .from(messages)
        .where(eq(messages.agentId, c.req.param('id')))
        .orderBy(asc(messages.createdAt))
        .all()
      return c.json({ messages: rows })
    })
    .get('/:id/routines', (c) => {
      const rows = deps.db
        .select()
        .from(routines)
        .where(eq(routines.agentId, c.req.param('id')))
        .orderBy(asc(routines.createdAt))
        .all()
      return c.json({ routines: rows })
    })
}
