import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, gt } from 'drizzle-orm'
import { Hono } from 'hono'
import type { SSEStreamingApi } from 'hono/streaming'
import { streamSSE } from 'hono/streaming'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { conversations } from '../../db/schema/conversations.sql'
import { type ChatTuple, TurnInProgressError } from '../chat/ChatSession'
import { getEventBus } from '../chat/eventBus'
import type { PersistedEvent } from '../chat/events.types'
import { getSessionManager } from '../chat/sessionManager'
import { getDb } from '../db-singleton'

const AGENT_IDS = ['claude', 'codex', 'gemini', 'hermes'] as const

type ConversationRow = typeof conversations.$inferSelect

function serializeConversation(row: ConversationRow) {
  return {
    ...row,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

// Tuple fields are optional on every endpoint — clients may omit them
// (e.g. /chat without modelId) and we fall back to the agent default or
// the conversation row's persisted value.
const tupleFields = {
  modelId: z.string().min(1).nullish(),
  workspacePath: z.string().min(1).nullish(),
  reasoningEffort: z.string().min(1).nullish(),
} as const

const createSchema = z
  .object({
    agentId: z.enum(AGENT_IDS),
    title: z.string().min(1).max(200).optional(),
    ...tupleFields,
  })
  .strict()

const sendSchema = z
  .object({
    text: z.string().min(1),
    agentId: z.enum(AGENT_IDS).optional(),
    ...tupleFields,
  })
  .strict()
const cancelSchema = z.object({ reason: z.string().optional() }).strict()
const conversationQuery = z
  .object({ afterSeq: z.string().optional() })
  .optional()

function parseAfter(raw: string | undefined | null): number {
  if (!raw) return -1
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : -1
}

async function loadEvents(conversationId: string, afterSeq: number) {
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

export const chatRoute = new Hono()
  .post('/chat', zValidator('json', createSchema), async (c) => {
    const body = c.req.valid('json')
    const now = new Date()
    const row = {
      id: nanoid(),
      title: body.title ?? 'New conversation',
      agentId: body.agentId,
      modelId: body.modelId ?? null,
      workspacePath: body.workspacePath ?? null,
      reasoningEffort: body.reasoningEffort ?? null,
      acpxSessionId: null,
      acpxRecordId: null,
      agentSessionId: null,
      status: 'idle' as const,
      createdAt: now,
      updatedAt: now,
    }
    await getDb().insert(conversations).values(row).run()
    return c.json(serializeConversation(row))
  })
  .get('/chat', async (c) => {
    const rows = await getDb()
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .all()
    return c.json(rows.map((r) => serializeConversation(r)))
  })
  .get('/chat/:id', zValidator('query', conversationQuery), async (c) => {
    const id = c.req.param('id')
    const conv = await getDb()
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .get()
    if (!conv) return c.json({ error: 'not found' }, 404)

    const after = parseAfter(c.req.valid('query')?.afterSeq)
    const events = await loadEvents(id, after)
    return c.json({
      conversation: serializeConversation(conv),
      events: events.map((e) => ({
        seq: e.seq,
        type: e.type,
        payload: JSON.parse(e.payload),
        createdAt: e.createdAt.getTime(),
      })),
    })
  })
  .delete('/chat/:id', async (c) => {
    const id = c.req.param('id')
    await getSessionManager().dispose(id)
    await getDb().delete(conversations).where(eq(conversations.id, id)).run()
    return c.json({ ok: true })
  })
  .post('/chat/:id/messages', zValidator('json', sendSchema), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    try {
      // Resolve the tuple from the request, falling back to the
      // conversation row's last-used tuple. Any omitted field stays at the
      // persisted value — partial updates are explicit.
      const conv = await getDb()
        .select()
        .from(conversations)
        .where(eq(conversations.id, id))
        .get()
      if (!conv) return c.json({ error: 'conversation not found' }, 404)

      // `undefined` = field omitted in the request → keep the persisted
      // value. `null` = user explicitly cleared back to "agent default"
      // via the picker; preserve it. `??` would collapse both into the
      // persisted value and leave the user unable to clear a selection.
      const tuple: ChatTuple = {
        agentId: body.agentId ?? conv.agentId,
        modelId: body.modelId === undefined ? conv.modelId : body.modelId,
        workspacePath:
          body.workspacePath === undefined
            ? conv.workspacePath
            : body.workspacePath,
        reasoningEffort:
          body.reasoningEffort === undefined
            ? conv.reasoningEffort
            : body.reasoningEffort,
      }

      const session = await getSessionManager().getOrCreate(id)
      const result = await session.appendUserMessage(body.text, tuple)
      return c.json(result, 202)
    } catch (err) {
      if (err instanceof TurnInProgressError) {
        return c.json({ error: 'turn in progress' }, 409)
      }
      if (err instanceof Error && /not found/i.test(err.message)) {
        return c.json({ error: 'conversation not found' }, 404)
      }
      throw err
    }
  })
  .post('/chat/:id/cancel', zValidator('json', cancelSchema), async (c) => {
    const id = c.req.param('id')
    const { reason } = c.req.valid('json')
    const session = getSessionManager().get(id)
    if (!session) return c.json({ ok: true, idle: true })
    await session.cancel(reason)
    return c.json({ ok: true })
  })
  .get('/chat/:id/stream', (c) => {
    const id = c.req.param('id')
    const after = parseAfter(
      c.req.header('Last-Event-ID') ?? c.req.query('after'),
    )
    return streamSSE(c, (stream) => runChatStream(stream, id, after))
  })

async function runChatStream(
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
