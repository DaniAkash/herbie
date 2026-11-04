import type { Db } from '@bun/modules/db/db'
import { routineRuns, routines } from '@bun/modules/db/schema/schema'
import { matches } from '@bun/modules/loop/schedule'
import { toCron } from '@bun/modules/routines/cadence'
import type { AcpxHostToolSchema } from 'acpx-ai-provider'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

/**
 * The argument shapes for the routine tools, and the view they hand back.
 *
 * Split from the tools themselves for the same reason the reporting tools
 * are: the descriptions are long, because they are the contract, and a file
 * holding both outgrows what anyone reads in one sitting.
 */

const nameShape = z.string().min(1).max(80)
const cadenceShape = z.string().min(1).max(120)
const promptShape = z.string().min(1).max(4000)

export const listShape = z.object({}).strict()
export const createShape = z
  .object({ name: nameShape, cadence: cadenceShape, prompt: promptShape })
  .strict()
export const updateShape = z
  .object({
    id: z.string().min(1),
    name: nameShape.optional(),
    cadence: cadenceShape.optional(),
    prompt: promptShape.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.cadence !== undefined ||
      value.prompt !== undefined,
    'Change at least one of name, cadence or prompt.',
  )
export const enabledShape = z
  .object({ id: z.string().min(1), enabled: z.boolean() })
  .strict()
export const deleteShape = z.object({ id: z.string().min(1) }).strict()

export function schemaOf(shape: z.ZodType): AcpxHostToolSchema {
  return z.toJSONSchema(shape, {
    target: 'draft-7',
    io: 'input',
  }) as AcpxHostToolSchema
}

export interface RoutineView {
  readonly id: string
  readonly name: string
  readonly cadence: string
  readonly reading: string | null
  readonly enabled: boolean
  readonly prompt: string
  readonly lastRunAt: string | null
  readonly nextRunAt: string | null
  readonly fires: boolean
}

/**
 * When this cron next comes round, by walking forward a minute at a time.
 *
 * A year of minutes is the bound, which is more than any cadence the
 * grammar can express needs. Walking rather than solving keeps one matcher
 * in the codebase: a second implementation that disagreed with the loop's
 * would show the person a time the routine does not actually run at.
 */
export function nextRun(cron: string | null, from: number): string | null {
  if (!cron) return null
  const start = new Date(from)
  start.setSeconds(0, 0)
  for (let minute = 1; minute <= 366 * 24 * 60; minute += 1) {
    const at = start.getTime() + minute * 60_000
    if (matches(cron, at)) return new Date(at).toISOString()
  }
  return null
}

export function view(
  row: typeof routines.$inferSelect,
  lastRunAt: string | null,
  now: number,
): RoutineView {
  const reading = toCron(row.cadence)
  return {
    id: row.id,
    name: row.name,
    cadence: row.cadence,
    reading: reading?.reading ?? null,
    enabled: row.enabled,
    prompt: row.prompt,
    lastRunAt,
    nextRunAt: row.enabled ? nextRun(row.cron, now) : null,
    fires: row.cron !== null,
  }
}

export function lastRunOf(db: Db, routineId: string): string | null {
  const row = db
    .select()
    .from(routineRuns)
    .where(
      and(eq(routineRuns.routineId, routineId), eq(routineRuns.state, 'done')),
    )
    .orderBy(desc(routineRuns.dueAt))
    .limit(1)
    .get()
  return row?.dueAt ?? null
}

export function find(
  db: Db,
  agentId: string,
  id: string,
): typeof routines.$inferSelect | undefined {
  return db
    .select()
    .from(routines)
    .where(and(eq(routines.id, id), eq(routines.agentId, agentId)))
    .get()
}

/** Everything the agent is allowed to know, so it can list or confirm. */
export function listRoutines(
  db: Db,
  agentId: string,
  now: number,
): RoutineView[] {
  return db
    .select()
    .from(routines)
    .where(eq(routines.agentId, agentId))
    .all()
    .map((row) => view(row, lastRunOf(db, row.id), now))
}
