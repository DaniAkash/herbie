import { and, eq, gt } from 'drizzle-orm'
import type { SSEStreamingApi } from 'hono/streaming'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { getEventBus } from '../chat/eventBus'
import type { PersistedEvent } from '../chat/events.types'
import { getSessionManager } from '../chat/sessionManager'
import { getDb } from '../db-singleton'

export function parseAfter(raw: string | undefined | null): number {
  if (!raw) return -1
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : -1
}

export async function runChatStream(
  stream: SSEStreamingApi,
  id: string,
  after: number,
): Promise<void> {
  // Subscribe before replay so events arriving mid-replay aren't lost.
  // Buffered events drain at the end with dedupe against `lastReplaySeq`.
  const liveBuffer: PersistedEvent[] = []
  let replaying = true

  const writeLive = (ev: PersistedEvent) =>
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
        // Connection closed mid-write; the abort handler will clean up.
      })

  const unsub = getEventBus().subscribe(id, (ev) => {
    if (replaying) liveBuffer.push(ev)
    else void writeLive(ev)
  })
  stream.onAbort(unsub)

  let lastReplaySeq = await replayDbEvents(stream, id, after)
  lastReplaySeq = await replayActiveTurn(stream, id, lastReplaySeq, writeLive)

  replaying = false
  for (const e of liveBuffer) {
    if (e.seq > lastReplaySeq) await writeLive(e)
  }
  liveBuffer.length = 0

  await new Promise<void>((resolve) => stream.onAbort(resolve))
}

async function replayDbEvents(
  stream: SSEStreamingApi,
  id: string,
  after: number,
): Promise<number> {
  const replay = await loadEvents(id, after)
  for (const e of replay) {
    if (stream.aborted || stream.closed) return after
    // Hand-build the JSON envelope so we don't parse + re-stringify the
    // already-encoded payload column for every replayed event.
    await stream.writeSSE({
      id: String(e.seq),
      data: `{"type":${JSON.stringify(e.type)},"payload":${e.payload},"createdAt":${e.createdAt.getTime()}}`,
    })
  }
  return replay.length > 0 ? (replay[replay.length - 1]?.seq ?? after) : after
}

// Bridges DB replay (terminal events from past turns) and the live bus
// (events emitted from now on). Without this, a subscriber that connects
// mid-turn would never see ephemeral stream events emitted before it
// attached to the bus.
async function replayActiveTurn(
  stream: SSEStreamingApi,
  id: string,
  lastReplaySeq: number,
  writeLive: (ev: PersistedEvent) => Promise<void>,
): Promise<number> {
  const session = getSessionManager().get(id)
  if (!session) return lastReplaySeq
  const snapshot = session.getActiveTurnSnapshot(lastReplaySeq)
  for (const e of snapshot) {
    if (stream.aborted || stream.closed) return lastReplaySeq
    await writeLive(e)
  }
  const last = snapshot[snapshot.length - 1]
  return last ? last.seq : lastReplaySeq
}

export async function loadEvents(conversationId: string, afterSeq: number) {
  return getDb()
    .select()
    .from(chatEvents)
    .where(
      and(
        eq(chatEvents.conversationId, conversationId),
        gt(chatEvents.seq, afterSeq),
      ),
    )
    .orderBy(chatEvents.seq)
    .all()
}
