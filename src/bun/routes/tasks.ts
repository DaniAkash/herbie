import { zValidator } from '@hono/zod-validator'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { taskRuns } from '../../db/schema/task-runs.sql'
import { TASK_STATUSES, tasks } from '../../db/schema/tasks.sql'
import { getDb } from '../db-singleton'
import {
  loadAllRunEvents,
  parseAfter,
  runEventStream,
} from '../tasks/run-stream'
import { getRunManager } from '../tasks/runManager'
import { getTaskScheduler } from '../tasks/scheduler'

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

const testSchema = z
  .object({
    // All four are optional overrides; if any are omitted, the run
    // falls back to the persisted task row.
    prompt: z.string().min(1).optional(),
    agentId: z.enum(AGENT_IDS).optional(),
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
    await getTaskScheduler(getDb()).rescheduleTask(row.id)
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
    await getTaskScheduler(getDb()).rescheduleTask(id)
    const updated = { ...current, ...next }
    return c.json(serializeTask(updated))
  })
  .delete('/tasks/:id', async (c) => {
    const id = c.req.param('id')
    const result = await getDb().delete(tasks).where(eq(tasks.id, id)).run()
    if (result.rowsAffected === 0) {
      return c.json({ error: 'task not found' }, 404)
    }
    getTaskScheduler(getDb()).cancelTask(id)
    return c.json({ ok: true })
  })
  // The Test button fires this — accepts the editor's unsaved draft so
  // users can iterate without committing the task. The draft fields
  // override whatever's on the row; if the task hasn't been saved yet
  // the route still works as long as the taskId path param resolves.
  .post('/tasks/:id/test', zValidator('json', testSchema), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const task = await getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .get()
    if (!task) return c.json({ error: 'task not found' }, 404)

    const tuple = {
      agentId: body.agentId ?? task.agentId,
      modelId: body.modelId === undefined ? task.modelId : body.modelId,
      workspacePath:
        body.workspacePath === undefined
          ? task.workspacePath
          : body.workspacePath,
      reasoningEffort:
        body.reasoningEffort === undefined
          ? task.reasoningEffort
          : body.reasoningEffort,
    }
    const session = await getRunManager().start({
      taskId: id,
      promptSnapshot: body.prompt ?? task.prompt,
      tuple,
      trigger: 'test',
    })
    return c.json({ runId: session.id }, 202)
  })
  .get('/tasks/:id/runs', async (c) => {
    const id = c.req.param('id')
    const rows = await getDb()
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.taskId, id))
      .orderBy(desc(taskRuns.startedAt))
      .all()
    return c.json(rows.map(serializeRun))
  })
  .get('/tasks/:id/runs/:runId', async (c) => {
    const taskId = c.req.param('id')
    const runId = c.req.param('runId')
    const run = await getDb()
      .select()
      .from(taskRuns)
      .where(and(eq(taskRuns.id, runId), eq(taskRuns.taskId, taskId)))
      .get()
    if (!run) return c.json({ error: 'run not found' }, 404)
    const events = await loadAllRunEvents(runId)
    return c.json({
      run: serializeRun(run),
      events: events.map((e) => ({
        seq: e.seq,
        type: e.type,
        payload: JSON.parse(e.payload),
        createdAt: e.createdAt.getTime(),
      })),
    })
  })
  .post('/tasks/:id/runs/:runId/cancel', async (c) => {
    const taskId = c.req.param('id')
    const runId = c.req.param('runId')
    if (!(await runBelongsToTask(runId, taskId))) {
      return c.json({ error: 'run not found' }, 404)
    }
    await getRunManager().cancel(runId, 'user cancelled')
    return c.json({ ok: true })
  })
  .get('/tasks/:id/runs/:runId/stream', async (c) => {
    const taskId = c.req.param('id')
    const runId = c.req.param('runId')
    if (!(await runBelongsToTask(runId, taskId))) {
      return c.json({ error: 'run not found' }, 404)
    }
    const after = parseAfter(
      c.req.header('Last-Event-ID') ?? c.req.query('after'),
    )
    return streamSSE(c, (stream) => runEventStream(stream, runId, after))
  })

async function runBelongsToTask(
  runId: string,
  taskId: string,
): Promise<boolean> {
  const row = await getDb()
    .select({ id: taskRuns.id })
    .from(taskRuns)
    .where(and(eq(taskRuns.id, runId), eq(taskRuns.taskId, taskId)))
    .get()
  return row != null
}

type RunRow = typeof taskRuns.$inferSelect

function serializeRun(row: RunRow) {
  return {
    ...row,
    startedAt: row.startedAt.getTime(),
    finishedAt: row.finishedAt?.getTime() ?? null,
  }
}
