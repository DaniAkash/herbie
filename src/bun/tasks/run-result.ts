import { asc, eq } from 'drizzle-orm'
import type { DB } from '../../db'
import { taskRunEvents } from '../../db/schema/task-run-events.sql'
import type { TaskRunOutputSource } from '../../db/schema/task-runs.sql'
import { taskRuns } from '../../db/schema/task-runs.sql'

// Pulls the assistant text out of a stream part — invoked per part by
// TaskRunSession so we can persist a single concatenated `resultText`
// at finish. The AI SDK emits text-end with the same id as the
// preceding text-deltas and a `text` field carrying the aggregate.
export function extractAssistantTextFromPart(part: unknown): string | null {
  if (typeof part !== 'object' || part === null) return null
  const p = part as { type?: unknown; text?: unknown }
  if (p.type !== 'text-end') return null
  if (typeof p.text !== 'string' || p.text.length === 0) return null
  return p.text
}

// Fallback used when the stream's text-end parts didn't carry an
// aggregate (some agents stream only deltas). Reads the
// assistant.text events we persisted during the run and joins them.
export async function aggregateAssistantFromEvents(
  db: DB,
  runId: string,
): Promise<string | null> {
  const rows = await db
    .select()
    .from(taskRunEvents)
    .where(eq(taskRunEvents.runId, runId))
    .orderBy(asc(taskRunEvents.seq))
    .all()
  const texts: string[] = []
  for (const r of rows) {
    if (r.type !== 'assistant.text') continue
    try {
      const p = JSON.parse(r.payload) as { text?: string }
      if (typeof p.text === 'string') texts.push(p.text)
    } catch {}
  }
  return texts.length > 0 ? texts.join('').trim() : null
}

// Source picker — used by TaskRunSession.finalize() to stamp the
// row's outputSource column based on what the run actually produced.
//   tool  — markdown captured from the herbie__task_result MCP tool
//   text  — markdown null but the agent produced assistant text
//   empty — nothing useful in either field (also covers error /
//           cancel paths and silent completions)
export function pickOutputSource(
  markdown: string | null,
  text: string | null,
): TaskRunOutputSource {
  if (markdown && markdown.length > 0) return 'tool'
  if (text && text.length > 0) return 'text'
  return 'empty'
}

export interface FinalizeRowFields {
  status: 'completed' | 'cancelled' | 'error'
  resultText: string | null
  resultMarkdown: string | null
  outputSource: TaskRunOutputSource
  errorMessage: string | null
  errorCode: string | null
  errorDetails: string | null
}

// One write — keeps TaskRunSession.finalize() short and the column
// list in one place.
export async function writeFinalRow(
  db: DB,
  runId: string,
  fields: FinalizeRowFields,
): Promise<void> {
  await db
    .update(taskRuns)
    .set({
      status: fields.status,
      finishedAt: new Date(),
      resultText: fields.resultText,
      resultMarkdown: fields.resultMarkdown,
      outputSource: fields.outputSource,
      errorMessage: fields.errorMessage,
      errorCode: fields.errorCode,
      errorDetails: fields.errorDetails,
    })
    .where(eq(taskRuns.id, runId))
    .run()
}
