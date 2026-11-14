import {
  createAgent,
  deleteAgent,
  plannedWorkspace,
} from '@bun/modules/agents/agents'
import {
  agentRules,
  agents,
  routineRuns,
  routines,
} from '@bun/modules/db/schema/schema'
import { toCron } from '@bun/modules/routines/cadence'
import { nextRun } from '@bun/modules/routines/tools'
import { moveAccess } from '@bun/modules/tools/access'
import type { Deps } from '@bun/server/deps'
import {
  createAgentBody,
  createRoutineBody,
  createRuleBody,
  patchAgentBody,
  workspaceQuery,
} from '@bun/shared/schemas'
import { zValidator } from '@hono/zod-validator'
import { and, asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

/**
 * What the ledger says about a routine, for the panel to show.
 *
 * Read from the run rows rather than from the loop, so the panel is right
 * after a restart and does not need the loop wired into the server. A
 * routine is failing when its most recent attempts all failed in a row:
 * that is the same signal the breaker acts on, derived rather than shared.
 */
function runState(
  db: Deps['db'],
  routineId: string,
): { running: boolean; failingSince: string | null } {
  const recent = db
    .select()
    .from(routineRuns)
    .where(eq(routineRuns.routineId, routineId))
    .orderBy(desc(routineRuns.dueAt))
    .limit(3)
    .all()

  const running =
    db
      .select()
      .from(routineRuns)
      .where(
        and(
          eq(routineRuns.routineId, routineId),
          eq(routineRuns.state, 'running'),
        ),
      )
      .get() !== undefined

  const judged = recent.filter((row) => row.state !== 'skipped')
  const failing =
    judged.length >= 3 && judged.every((row) => row.state === 'failed')

  return {
    running,
    failingSince: failing ? (judged.at(-1)?.dueAt ?? null) : null,
  }
}

/**
 * Agents, their conversations, their routines and their rules.
 *
 * Chained rather than registered statement by statement, because Hono builds
 * the RPC types from the chain and a bare `app.route(...)` erases them.
 */
/** The row, or nothing. Written once because three handlers want it. */
function findAgent(db: Deps['db'], id: string) {
  return db.select().from(agents).where(eq(agents.id, id)).get()
}

export function agentsRoute(deps: Deps) {
  return (
    new Hono()
      .get('/', (c) => {
        const rows = deps.db
          .select()
          .from(agents)
          .orderBy(asc(agents.createdAt))
          .all()
        return c.json({ agents: rows })
      })
      .post('/', zValidator('json', createAgentBody), (c) => {
        const row = createAgent(deps.db, deps.agentsRoot, c.req.valid('json'))
        deps.notifyRefresh?.()
        return c.json({ agent: row }, 201)
      })
      // Before `/:id`, which would otherwise claim it: Hono matches a method's
      // routes in the order they were chained.
      .get('/workspace', zValidator('query', workspaceQuery), (c) =>
        c.json({
          path: plannedWorkspace(
            deps.db,
            deps.agentsRoot,
            c.req.valid('query').name,
          ),
        }),
      )
      .get('/:id', (c) => {
        const row = findAgent(deps.db, c.req.param('id'))
        if (!row) return c.json({ error: 'no such agent' }, 404)
        return c.json({ agent: row })
      })
      .patch('/:id', zValidator('json', patchAgentBody), async (c) => {
        const patch = c.req.valid('json')
        const id = c.req.param('id')
        const before = findAgent(deps.db, id)
        if (!before) return c.json({ error: 'no such agent' }, 404)

        // An empty patch reads the row instead of writing it: a form that
        // submits with nothing changed should not look like a failure, and
        // drizzle will not build an update with an empty set clause.
        const row =
          Object.keys(patch).length === 0
            ? before
            : deps.db
                .update(agents)
                .set(patch)
                .where(eq(agents.id, id))
                .returning()
                .get()
        if (!row) return c.json({ error: 'no such agent' }, 404)

        // The switches are rows and files, and the files are in the old
        // runtime's format, so a runtime change has to carry them across or the
        // panel reads as on against a runtime that can reach nothing.
        if (patch.acpAgent && patch.acpAgent !== before.acpAgent) {
          await moveAccess(deps.db, {
            agentId: id,
            from: before.acpAgent,
            to: patch.acpAgent,
            skillsWorkspace: deps.skillsWorkspace,
          })
        }
        deps.notifyRefresh?.()
        return c.json({ agent: row })
      })
      .delete('/:id', (c) => {
        const gone = deleteAgent(deps.db, deps.agentsRoot, c.req.param('id'))
        if (!gone) return c.json({ error: 'no such agent' }, 404)
        deps.notifyRefresh?.()
        return c.json({ deleted: true })
      })
      .get('/:id/routines', (c) => {
        const rows = deps.db
          .select()
          .from(routines)
          .where(eq(routines.agentId, c.req.param('id')))
          .orderBy(asc(routines.createdAt))
          .all()

        // The panel shows state, not just configuration, now that something
        // actually runs these. All of it is derived from the ledger rather
        // than from the loop's memory, so a restart does not blank it.
        const now = Date.now()
        return c.json({
          routines: rows.map((row) => ({
            ...row,
            nextRunAt: row.enabled ? nextRun(row.cron, now) : null,
            ...runState(deps.db, row.id),
          })),
        })
      })
      .post('/:id/routines', zValidator('json', createRoutineBody), (c) => {
        const body = c.req.valid('json')
        const row = deps.db
          .insert(routines)
          .values({
            id: crypto.randomUUID(),
            agentId: c.req.param('id'),
            ...body,
            // A schedule carries a cron the loop can act on; an event has no
            // time to resolve, so it keeps the phrase alone.
            cron:
              body.kind === 'schedule'
                ? (toCron(body.cadence)?.cron ?? null)
                : null,
          })
          .returning()
          .get()
        return c.json({ routine: row }, 201)
      })
      .get('/:id/rules', (c) => {
        const rows = deps.db
          .select()
          .from(agentRules)
          .where(eq(agentRules.agentId, c.req.param('id')))
          .orderBy(asc(agentRules.createdAt))
          .all()
        return c.json({ rules: rows })
      })
      .post('/:id/rules', zValidator('json', createRuleBody), (c) => {
        const row = deps.db
          .insert(agentRules)
          .values({
            id: crypto.randomUUID(),
            agentId: c.req.param('id'),
            ...c.req.valid('json'),
          })
          .returning()
          .get()
        return c.json({ rule: row }, 201)
      })
  )
}
