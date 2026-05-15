import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { conversations } from '../../db/schema/conversations.sql'
import { validateAgentId } from '../agents/registry'
import { type ChatTuple, TurnInProgressError } from '../chat/ChatSession'
import { getSessionManager } from '../chat/sessionManager'
import { getDb } from '../db-singleton'
import { mirrorAppTurnToTelegram } from '../telegram/outbound'
import { loadEvents, parseAfter, runChatStream } from './chat.stream'

// agentId is free-form at the schema level; runtime validation against
// the live registry happens inside each handler via the shared
// validateAgentId helper so Phase 2's custom agents are accepted
// without revisiting these validators.
const agentIdField = z.string().min(1)

type ConversationRow = typeof conversations.$inferSelect

function serializeConversation(row: ConversationRow) {
  return {
    ...row,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    // Surface these as numbers (or null) on the wire so the renderer
    // can compare timestamps without parsing ISO strings.
    lastSeenAt: row.lastSeenAt?.getTime() ?? null,
    pinnedAt: row.pinnedAt?.getTime() ?? null,
    archivedAt: row.archivedAt?.getTime() ?? null,
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
    agentId: agentIdField,
    title: z.string().min(1).max(200).optional(),
    ...tupleFields,
  })
  .strict()

const sendSchema = z
  .object({
    text: z.string().min(1),
    agentId: agentIdField.optional(),
    ...tupleFields,
  })
  .strict()
const cancelSchema = z.object({ reason: z.string().optional() }).strict()
const conversationQuery = z
  .object({ afterSeq: z.string().optional() })
  .optional()

// PATCH /chat/:id accepts a title rename, a pin/unpin toggle, or both.
// At least one field must be present — an empty patch is rejected so
// callers don't accidentally bump updatedAt with nothing to change.
const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    pinned: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.title !== undefined || v.pinned !== undefined, {
    message: 'patch must include title or pinned',
  })

export const chatRoute = new Hono()
  .post('/chat', zValidator('json', createSchema), async (c) => {
    const body = c.req.valid('json')
    const agentError = validateAgentId(body.agentId)
    if (agentError) return c.json({ error: agentError }, 400)
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
      origin: 'chat' as const,
      archivedAt: null,
      lastSeenAt: null,
      pinnedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    await getDb().insert(conversations).values(row).run()
    return c.json({ ...serializeConversation(row), unread: false })
  })
  .get('/chat', async (c) => {
    // Sidebar listing: only show in-app conversations that haven't
    // been archived. Telegram-origin threads render under their own
    // group via TelegramSidebarGroup; surfacing them here would
    // mix them with TODAY/YESTERDAY buckets.
    //
    // The correlated `lastEventAt` subquery powers the sidebar's
    // unread dot: an event whose createdAt > lastSeenAt is new since
    // the user last opened this conversation. `seq` is monotonic per
    // conversation, so picking the max-seq event via the
    // (conversation_id, seq) PK index — then reading its created_at —
    // is an O(log n) lookup, vs an O(n) scan if we MAX(created_at)
    // directly.
    const rows = await getDb()
      .select({
        conversation: conversations,
        lastEventAt: sql<number | null>`(
          SELECT ${chatEvents.createdAt}
          FROM ${chatEvents}
          WHERE ${chatEvents.conversationId} = ${conversations.id}
          ORDER BY ${chatEvents.seq} DESC
          LIMIT 1
        )`,
      })
      .from(conversations)
      .where(
        and(eq(conversations.origin, 'chat'), isNull(conversations.archivedAt)),
      )
      .orderBy(desc(conversations.updatedAt))
      .all()

    return c.json(
      rows.map(({ conversation, lastEventAt }) => {
        const serialized = serializeConversation(conversation)
        const unread =
          lastEventAt != null &&
          (serialized.lastSeenAt == null || lastEventAt > serialized.lastSeenAt)
        return { ...serialized, unread }
      }),
    )
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
  // Rename + pin/unpin. Refuses Telegram-origin rows because their
  // title is sourced from the upstream chat — mutating it locally
  // would drift and the next inbound message would clobber it anyway.
  .patch('/chat/:id', zValidator('json', patchSchema), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const conv = await getDb()
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .get()
    if (!conv) return c.json({ error: 'conversation not found' }, 404)
    if (conv.origin !== 'chat') {
      return c.json({ error: 'cannot modify telegram conversations' }, 400)
    }
    const next: Partial<typeof conversations.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (body.title !== undefined) next.title = body.title
    if (body.pinned !== undefined) {
      next.pinnedAt = body.pinned ? new Date() : null
    }
    await getDb()
      .update(conversations)
      .set(next)
      .where(eq(conversations.id, id))
      .run()
    return c.json({ ok: true })
  })
  // Bumps lastSeenAt to "now" so the sidebar's unread badge clears.
  // Called by the renderer when a conversation is opened. Idempotent.
  .post('/chat/:id/seen', async (c) => {
    const id = c.req.param('id')
    const result = await getDb()
      .update(conversations)
      .set({ lastSeenAt: new Date() })
      .where(eq(conversations.id, id))
      .run()
    if (result.rowsAffected === 0) {
      return c.json({ error: 'conversation not found' }, 404)
    }
    return c.json({ ok: true })
  })
  .post('/chat/:id/messages', zValidator('json', sendSchema), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    if (body.agentId !== undefined) {
      const agentError = validateAgentId(body.agentId)
      if (agentError) return c.json({ error: agentError }, 400)
    }
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

      // If this conversation is mapped to a Telegram chat, mirror the
      // user message + agent reply back so the Telegram side stays in
      // sync. Fire-and-forget: HTTP response returns immediately and
      // the mirror finishes alongside the SSE stream. No-ops for
      // in-app-only conversations and for paused/error connections.
      if (conv.origin === 'telegram') {
        void mirrorAppTurnToTelegram(id, result.requestId, body.text)
      }

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
