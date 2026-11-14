import { settings } from '@bun/modules/db/schema/schema'
import type { Deps } from '@bun/server/deps'
import { settingBody } from '@bun/shared/schemas'
import { zValidator } from '@hono/zod-validator'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'

/**
 * The key value table, finally reachable.
 *
 * It has existed since the first migration and quiet hours has been read
 * from it since the loop shipped, but nothing in production ever wrote one,
 * which is why the routines panel promised a window that no one could set.
 */
export function settingsRoute(deps: Deps) {
  return new Hono()
    .get('/', (c) => {
      const rows = deps.db.select().from(settings).all()
      const values: Record<string, string> = {}
      for (const row of rows) values[row.key] = row.value
      return c.json({ settings: values })
    })

    .put('/:key', zValidator('json', settingBody), (c) => {
      const key = c.req.param('key')
      const { value } = c.req.valid('json')
      const row = deps.db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, updatedAt: sql`(current_timestamp)` },
        })
        .returning()
        .get()
      return c.json({ setting: row })
    })
}
