import type { Db } from '@bun/modules/db/db'
import { settings } from '@bun/modules/db/schema/schema'
import { eq } from 'drizzle-orm'

const INSTALLED_AT = 'installed_at'

/**
 * Records when this database first came up, and returns it afterwards.
 *
 * Written on first boot rather than by a migration, because a migration knows
 * when it ran and not when the install happened: restoring a backup into a
 * fresh file would otherwise reset the date.
 */
export function ensureInstalledAt(db: Db, now = new Date()): string {
  const existing = db
    .select()
    .from(settings)
    .where(eq(settings.key, INSTALLED_AT))
    .get()
  if (existing) return existing.value

  const value = now.toISOString()
  db.insert(settings)
    .values({ key: INSTALLED_AT, value, updatedAt: value })
    .run()
  return value
}
