import { agentTools, mcpServers, skills } from '@bun/modules/db/schema/schema'
import { applyAccess } from '@bun/modules/tools/access'
import type { Deps } from '@bun/server/deps'
import { accessBody } from '@bun/shared/schemas'
import { zValidator } from '@hono/zod-validator'
import { and, asc, eq } from 'drizzle-orm'
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
    .patch('/access/:agentId', zValidator('json', accessBody), async (c) => {
      const agentId = c.req.param('agentId')
      const { kind, refId, enabled } = c.req.valid('json')
      const updatedAt = new Date().toISOString()

      // Upserting on the unique index rather than reading first and then
      // writing: two switches flipped quickly would otherwise both read the
      // same absent row and both insert.
      deps.db
        .insert(agentTools)
        .values({ agentId, kind, refId, enabled, updatedAt })
        .onConflictDoUpdate({
          target: [agentTools.agentId, agentTools.kind, agentTools.refId],
          set: { enabled, updatedAt },
        })
        .run()

      const row = deps.db
        .select()
        .from(agentTools)
        .where(
          and(
            eq(agentTools.agentId, agentId),
            eq(agentTools.kind, kind),
            eq(agentTools.refId, refId),
          ),
        )
        .get()

      // The row is the record of what was asked for and is written either
      // way. Writing the runtime's own config is the part that can fail, on
      // a runtime whose format this build does not know, so it is reported
      // rather than allowed to undo the setting.
      const note = await applyAccess(deps.db, {
        agentId,
        kind,
        refId,
        enabled,
        skillsWorkspace: deps.skillsWorkspace,
      })

      return c.json({ access: row, note })
    })
}
