import { createAgent, deleteAgent } from '@bun/modules/agents/agents'
import {
  agentRules,
  agents,
  messages,
  routines,
} from '@bun/modules/db/schema/schema'
import { toCron } from '@bun/modules/routines/cadence'
import type { Deps } from '@bun/server/deps'
import {
  createAgentBody,
  createRoutineBody,
  createRuleBody,
  patchAgentBody,
} from '@bun/server/schemas'
import { zValidator } from '@hono/zod-validator'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

/**
 * Agents, their conversations, their routines and their rules.
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
    .post('/', zValidator('json', createAgentBody), (c) => {
      const row = createAgent(deps.db, deps.agentsRoot, c.req.valid('json'))
      return c.json({ agent: row }, 201)
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
    .patch('/:id', zValidator('json', patchAgentBody), (c) => {
      const patch = c.req.valid('json')
      // An empty patch is a no op rather than an error: a form that submits
      // nothing changed should not look like a failure.
      if (Object.keys(patch).length === 0) {
        const row = deps.db
          .select()
          .from(agents)
          .where(eq(agents.id, c.req.param('id')))
          .get()
        if (!row) return c.json({ error: 'no such agent' }, 404)
        return c.json({ agent: row })
      }
      const row = deps.db
        .update(agents)
        .set(patch)
        .where(eq(agents.id, c.req.param('id')))
        .returning()
        .get()
      if (!row) return c.json({ error: 'no such agent' }, 404)
      return c.json({ agent: row })
    })
    .delete('/:id', (c) => {
      const gone = deleteAgent(deps.db, deps.agentsRoot, c.req.param('id'))
      if (!gone) return c.json({ error: 'no such agent' }, 404)
      return c.json({ deleted: true })
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
}
