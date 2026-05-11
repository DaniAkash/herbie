import { and, asc, eq, gt } from 'drizzle-orm'
import type { SSEStreamingApi } from 'hono/streaming'
import { taskRunEvents } from '../../db/schema/task-run-events.sql'
import { getDb } from '../db-singleton'
import { getRunEventBus } from './run-event-bus'
import type { PersistedRunEvent } from './run-events'
import { getRunManager } from './runManager'

export function parseAfter(raw: string | undefined | null): number {
  if (!raw) return -1
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : -1
}

async function loadRunEvents(runId: string, afterSeq: number) {
  return getDb()
    .select()
    .from(taskRunEvents)
    .where(and(eq(taskRunEvents.runId, runId), gt(taskRunEvents.seq, afterSeq)))
    .orderBy(asc(taskRunEvents.seq))
    .all()
}

// Replay-then-live SSE driver. Subscribes to the run bus before
// reading the DB so events arriving mid-replay aren't lost — they
// land in a buffer and drain after the DB rows finish, with seq-based
// dedupe. Mirrors the chat-side helper of the same name in shape.
export async function runEventStream(
  stream: SSEStreamingApi,
  runId: string,
  after: number,
): Promise<void> {
  const liveBuffer: PersistedRunEvent[] = []
  let replaying = true

  const writeLive = (ev: PersistedRunEvent) =>
    stream
      .writeSSE({
        id: String(ev.seq),
        data: JSON.stringify({
          type: ev.type,
          payload: ev.payload,
          createdAt: ev.createdAt.getTime(),
        }),
      })
      .catch(() => {
        // Connection dropped mid-write — the abort handler runs the
        // unsubscribe; nothing else to do.
      })

  const unsub = getRunEventBus().subscribe(runId, (ev) => {
    if (replaying) liveBuffer.push(ev)
    else void writeLive(ev)
  })
  stream.onAbort(unsub)

  let lastReplaySeq = await replayRunDbEvents(stream, runId, after)
  lastReplaySeq = await replayActiveRunSnapshot(runId, lastReplaySeq, writeLive)

  replaying = false
  for (const e of liveBuffer) {
    if (e.seq > lastReplaySeq) await writeLive(e)
  }
  liveBuffer.length = 0

  await new Promise<void>((resolve) => stream.onAbort(resolve))
}

async function replayRunDbEvents(
  stream: SSEStreamingApi,
  runId: string,
  after: number,
): Promise<number> {
  const replay = await loadRunEvents(runId, after)
  for (const e of replay) {
    if (stream.aborted || stream.closed) return after
    // Hand-build the JSON envelope so we don't parse + re-stringify
    // the already-encoded payload column.
    await stream.writeSSE({
      id: String(e.seq),
      data: `{"type":${JSON.stringify(e.type)},"payload":${e.payload},"createdAt":${e.createdAt.getTime()}}`,
    })
  }
  return replay.length > 0 ? (replay[replay.length - 1]?.seq ?? after) : after
}

async function replayActiveRunSnapshot(
  runId: string,
  lastReplaySeq: number,
  writeLive: (ev: PersistedRunEvent) => Promise<void>,
): Promise<number> {
  const session = getRunManager().get(runId)
  if (!session) return lastReplaySeq
  const snapshot = session.getActiveTurnSnapshot(lastReplaySeq)
  for (const e of snapshot) await writeLive(e)
  const last = snapshot[snapshot.length - 1]
  return last ? last.seq : lastReplaySeq
}

// Used by the GET /tasks/:id/runs/:runId detail route, which returns
// the full event log along with the run row.
export async function loadAllRunEvents(runId: string) {
  return loadRunEvents(runId, -1)
}
