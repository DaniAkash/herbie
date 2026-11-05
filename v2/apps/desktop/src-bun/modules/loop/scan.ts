import { createLogger } from '@bun/lib/log'
import type { Db } from '@bun/modules/db/db'
import { routines, settings } from '@bun/modules/db/schema/schema'
import { enqueue } from '@bun/modules/loop/queue'
import {
  parseQuietHours,
  type QuietHours,
  slotOf,
  verdictFor,
} from '@bun/modules/loop/schedule'
import { eq } from 'drizzle-orm'

const log = createLogger('loop')

/**
 * What this minute owes, and when the person would rather it owed nothing.
 *
 * Separated from the loop because it is the half with no side effects worth
 * reasoning about: it reads two tables and writes at most one row per
 * routine, and it is idempotent over a slot.
 */

export const QUIET_HOURS_KEY = 'loop.quietHours'

/**
 * The window the panel has always promised, as the default.
 *
 * Defaulted here rather than written on install, so it holds for databases
 * that already exist as well as new ones. Until this was added the setting
 * had no writer anywhere in production, which made "nothing runs from
 * eleven to seven" a sentence in the panel and nothing else.
 */
export const DEFAULT_QUIET_HOURS = '23:00-07:00'
/** Finished rows older than this are dropped, so the ledger stays small. */
function quietHours(db: Db): QuietHours | null {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, QUIET_HOURS_KEY))
    .get()
  // An explicit empty value is how quiet hours are turned off, which is
  // different from never having been set.
  if (row?.value === '') return null
  return parseQuietHours(row?.value ?? DEFAULT_QUIET_HOURS)
}

/**
 * Enqueues whatever this minute owes, once.
 *
 * Quiet hours record a skipped row rather than holding the work, because a
 * report about this morning delivered at seven is useful and eight overnight
 * reports delivered at once are not.
 */
export function scan(db: Db, at: number): void {
  const quiet = quietHours(db)
  const slot = slotOf(at)

  for (const routine of db.select().from(routines).all()) {
    const verdict = verdictFor(
      {
        id: routine.id,
        agentId: routine.agentId,
        cron: routine.cron,
        enabled: routine.enabled,
        kind: routine.kind,
      },
      at,
      quiet,
    )
    if (verdict === 'not-due') continue

    const created = enqueue(db, {
      routineId: routine.id,
      agentId: routine.agentId,
      dueAt: slot,
      state: verdict === 'quiet' ? 'skipped' : 'queued',
    })
    if (created) {
      log.info(
        verdict === 'quiet' ? 'routine skipped, quiet hours' : 'routine due',
        {
          routine: routine.id,
          agent: routine.agentId,
        },
      )
    }
  }
}
