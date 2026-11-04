import { routines } from '@bun/modules/db/schema/schema'
import { toCron } from '@bun/modules/routines/cadence'
import type { Deps } from '@bun/server/deps'
import { patchRoutineBody } from '@bun/shared/schemas'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

/**
 * One routine at a time.
 *
 * Creating one belongs to the agent that owns it and lives under /agents;
 * these are the operations that only need the routine's own id.
 */
export function routinesRoute(deps: Deps) {
  return new Hono()
    .patch('/:id', zValidator('json', patchRoutineBody), (c) => {
      const patch = c.req.valid('json')
      const current = deps.db
        .select()
        .from(routines)
        .where(eq(routines.id, c.req.param('id')))
        .get()
      if (!current) return c.json({ error: 'no such routine' }, 404)

      // The cron is derived, so it is recomputed whenever either of the two
      // things it derives from moves. Leaving a stale cron behind an edited
      // cadence is how a routine keeps firing at the old time.
      const kind = patch.kind ?? current.kind
      const cadence = patch.cadence ?? current.cadence
      const cron = kind === 'schedule' ? (toCron(cadence)?.cron ?? null) : null

      const row = deps.db
        .update(routines)
        .set({ ...patch, cron })
        .where(eq(routines.id, c.req.param('id')))
        .returning()
        .get()
      return c.json({ routine: row })
    })
    .delete('/:id', (c) => {
      const row = deps.db
        .delete(routines)
        .where(eq(routines.id, c.req.param('id')))
        .returning()
        .get()
      if (!row) return c.json({ error: 'no such routine' }, 404)
      return c.json({ deleted: true })
    })
}
