import { zValidator } from '@hono/zod-validator'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { TASK_STATUSES, tasks } from '../../db/schema/tasks.sql'
import { getDb } from '../db-singleton'

const AGENT_IDS = ['claude', 'codex', 'gemini', 'hermes'] as const

// ScheduleConfig — kept as a discriminated union mirroring the
// renderer's shape. Stored as JSON on the row; validated here.
const scheduleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('daily'),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  z.object({
    kind: z.literal('interval'),
    hours: z.number().int().min(1).max(168),
  }),
  z.object({
    kind: z.literal('weekly'),
    weekday: z.number().int().min(0).max(6),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  z.object({
    kind: z.literal('cron'),
    cron: z.string().min(1).max(120),
  }),
])

// Extra delivery channels beyond inbox (inbox is implicit). Today the
// only candidate is telegram, but its toggle is disabled in the UI
// until the feature ships, so this is effectively always [].
const outputSchema = z.array(z.enum(['telegram']))

const tupleFields = {
  modelId: z.string().min(1).nullish(),
  workspacePath: z.string().min(1).nullish(),
  reasoningEffort: z.string().min(1).nullish(),
} as const

const createSchema = z
  .object({
    name: z.string().min(1).max(120),
    prompt: z.string().min(1),
    agentId: z.enum(AGENT_IDS),
    schedule: scheduleSchema,
    outputs: outputSchema.optional(),
    ...tupleFields,
  })
  .strict()

const updateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    prompt: z.string().min(1).optional(),
    agentId: z.enum(AGENT_IDS).optional(),
    schedule: scheduleSchema.optional(),
    outputs: outputSchema.optional(),
    status: z.enum(TASK_STATUSES).optional(),
    ...tupleFields,
  })
  .strict()

type TaskRow = typeof tasks.$inferSelect

function serializeTask(row: TaskRow) {
  return {
    ...row,
    schedule: JSON.parse(row.scheduleJson) as z.infer<typeof scheduleSchema>,
    outputs: JSON.parse(row.outputsJson) as z.infer<typeof outputSchema>,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    lastRunAt: row.lastRunAt?.getTime() ?? null,
    nextRunAt: row.nextRunAt?.getTime() ?? null,
    // Strip the JSON columns — clients work with the parsed shape
    // exclusively.
    scheduleJson: undefined,
    outputsJson: undefined,
  }
}

export const tasksRoute = new Hono()
  .get('/tasks', async (c) => {
    const rows = await getDb()
      .select()
      .from(tasks)
      .orderBy(desc(tasks.updatedAt))
      .all()
    return c.json(rows.map(serializeTask))
  })
  .post('/tasks', zValidator('json', createSchema), async (c) => {
    const body = c.req.valid('json')
    const now = new Date()
    const row = {
      id: nanoid(),
      name: body.name,
      prompt: body.prompt,
      agentId: body.agentId,
      modelId: body.modelId ?? null,
      workspacePath: body.workspacePath ?? null,
      reasoningEffort: body.reasoningEffort ?? null,
      scheduleJson: JSON.stringify(body.schedule),
      status: 'active' as const,
      outputsJson: JSON.stringify(body.outputs ?? []),
      lastRunAt: null,
      nextRunAt: null,
      createdAt: now,
      updatedAt: now,
    }
    await getDb().insert(tasks).values(row).run()
    return c.json(serializeTask(row))
  })
  .get('/tasks/:id', async (c) => {
    const id = c.req.param('id')
    const row = await getDb().select().from(tasks).where(eq(tasks.id, id)).get()
    if (!row) return c.json({ error: 'task not found' }, 404)
    return c.json(serializeTask(row))
  })
  .patch('/tasks/:id', zValidator('json', updateSchema), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const current = await getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .get()
    if (!current) return c.json({ error: 'task not found' }, 404)

    // null vs undefined: undefined = keep persisted, null = explicit clear.
    // Same pattern as the chat composer's tuple merge.
    const next = {
      name: body.name ?? current.name,
      prompt: body.prompt ?? current.prompt,
      agentId: body.agentId ?? current.agentId,
      modelId: body.modelId === undefined ? current.modelId : body.modelId,
      workspacePath:
        body.workspacePath === undefined
          ? current.workspacePath
          : body.workspacePath,
      reasoningEffort:
        body.reasoningEffort === undefined
          ? current.reasoningEffort
          : body.reasoningEffort,
      scheduleJson: body.schedule
        ? JSON.stringify(body.schedule)
        : current.scheduleJson,
      outputsJson: body.outputs
        ? JSON.stringify(body.outputs)
        : current.outputsJson,
      status: body.status ?? current.status,
      updatedAt: new Date(),
    }
    await getDb().update(tasks).set(next).where(eq(tasks.id, id)).run()
    const updated = { ...current, ...next }
    return c.json(serializeTask(updated))
  })
  .delete('/tasks/:id', async (c) => {
    const id = c.req.param('id')
    const result = await getDb().delete(tasks).where(eq(tasks.id, id)).run()
    if (result.rowsAffected === 0) {
      return c.json({ error: 'task not found' }, 404)
    }
    return c.json({ ok: true })
  })
