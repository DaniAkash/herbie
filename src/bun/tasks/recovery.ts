import { asc, eq, inArray } from 'drizzle-orm'
import type { DB } from '../../db'
import { taskRunEvents } from '../../db/schema/task-run-events.sql'
import { taskRuns } from '../../db/schema/task-runs.sql'

const TERMINAL_TURN_TYPES = new Set([
  'turn.finish',
  'turn.cancel',
  'turn.error',
])

// Mirror of chat/recovery.ts for task runs. On boot, scan task_runs
// rows still flagged 'running' (the previous bun process died before
// finalize() landed) and close the loop by appending a synthetic
// turn.cancel event + flipping status to 'cancelled'. Without this
// the renderer's reducer would render a phantom streaming message in
// the sidebar forever.
export async function recoverInterruptedRuns(db: DB): Promise<void> {
  const rows = await db
    .select({ id: taskRuns.id })
    .from(taskRuns)
    .where(inArray(taskRuns.status, ['running']))
    .all()

  for (const row of rows) {
    await closeDanglingRun(db, row.id)
  }
}

async function closeDanglingRun(db: DB, runId: string): Promise<void> {
  const events = await db
    .select()
    .from(taskRunEvents)
    .where(eq(taskRunEvents.runId, runId))
    .orderBy(asc(taskRunEvents.seq))
    .all()

  // Find the latest turn.start without a matching terminal event.
  let lastTurnStart: { seq: number; requestId: string } | null = null
  for (const e of events) {
    if (e.type === 'turn.start') {
      const requestId = safeParseRequestId(e.payload)
      if (requestId) lastTurnStart = { seq: e.seq, requestId }
    } else if (lastTurnStart && TERMINAL_TURN_TYPES.has(e.type)) {
      lastTurnStart = null
    }
  }

  const finishedAt = new Date()
  if (lastTurnStart) {
    const nextSeq = (events.at(-1)?.seq ?? -1) + 1
    await db
      .insert(taskRunEvents)
      .values({
        runId,
        seq: nextSeq,
        type: 'turn.cancel',
        payload: JSON.stringify({
          requestId: lastTurnStart.requestId,
          reason: 'session interrupted',
        }),
        createdAt: finishedAt,
      })
      .run()
  }
  await db
    .update(taskRuns)
    .set({ status: 'cancelled', finishedAt })
    .where(eq(taskRuns.id, runId))
    .run()
}

function safeParseRequestId(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { requestId?: unknown }
    return typeof parsed.requestId === 'string' ? parsed.requestId : null
  } catch {
    return null
  }
}
