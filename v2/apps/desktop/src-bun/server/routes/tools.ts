import { agentTools, mcpServers, skills } from '@bun/modules/db/schema/schema'
import type { Deps } from '@bun/server/deps'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

/**
 * The shared library, plus which agent may reach what.
 *
 * Servers and skills are defined once. `access` carries the per agent
 * switches, so two agents reading the same library can see different sets.
 */
export function toolsRoute(deps: Deps) {
  return new Hono()
    .get('/', (c) => {
      const servers = deps.db
        .select()
        .from(mcpServers)
        .orderBy(asc(mcpServers.name))
        .all()
      const skillRows = deps.db
        .select()
        .from(skills)
        .orderBy(asc(skills.name))
        .all()
      return c.json({ servers, skills: skillRows })
    })
    .get('/access/:agentId', (c) => {
      const rows = deps.db
        .select()
        .from(agentTools)
        .where(eq(agentTools.agentId, c.req.param('agentId')))
        .all()
      return c.json({ access: rows })
    })
}
