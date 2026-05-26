import { zValidator } from '@hono/zod-validator'
import { desc, eq, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { nanoid } from 'nanoid'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { conversations } from '../../db/schema/conversations.sql'
import { validateAgentId } from '../agents/registry'
import { TurnInProgressError } from '../chat/ChatSession'
import { resolvePending as resolvePermission } from '../chat/permission-callback'
import { getSessionManager } from '../chat/sessionManager'
import { getDb } from '../db-singleton'
import { mirrorAppTurnToTelegram } from '../telegram/outbound'
import { removeConversationAttachments } from './attachments'
import { buildPatchUpdate } from './chat.patch-helpers'
import {
  cancelSchema,
  conversationQuery,
  createSchema,
  patchSchema,
  permissionDecisionSchema,
  sendSchema,
} from './chat.schemas'
import { loadConvAttachments, mergeSendTuple } from './chat.send-helpers'
import { loadEvents, parseAfter, runChatStream } from './chat.stream'
import { loadTelegramLinks } from './chat.telegram-links'
import { readSettings } from './settings'

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

export const chatRoute = new Hono()
  .post('/chat', zValidator('json', createSchema), async (c) => {
    const body = c.req.valid('json')
    const agentError = await validateAgentId(body.agentId)
    if (agentError) return c.json({ error: agentError }, 400)
    const settings = await readSettings()
    const now = new Date()
    const row = {
      id: nanoid(),
      title: body.title ?? 'New conversation',
      agentId: body.agentId,
      modelId: body.modelId ?? null,
      workspacePath: body.workspacePath ?? null,
      reasoningEffort: body.reasoningEffort ?? null,
      // Snapshot the user's current default at creation time. After
      // creation the conversation owns its own permission_mode column;
      // bumping the settings default later won't retroactively change
      // existing conversations.
      permissionMode: settings.general.defaultPermissionMode,
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
    // Unified sidebar listing: all non-archived conversations,
    // regardless of origin. Each row also carries telegramLink (the
    // bot the conversation is reachable from, if any) and
    // isActiveForTelegram (true when this is the live route from a
    // remote_control bot's pointer).
    const db = getDb()
    const rows = await db
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
      .where(isNull(conversations.archivedAt))
      .orderBy(desc(conversations.updatedAt))
      .all()

    if (rows.length === 0) return c.json([])

    const links = await loadTelegramLinks(rows.map((r) => r.conversation.id))
    return c.json(
      rows.map(({ conversation, lastEventAt }) => {
        const serialized = serializeConversation(conversation)
        const unread =
          lastEventAt != null &&
          (serialized.lastSeenAt == null || lastEventAt > serialized.lastSeenAt)
        return {
          ...serialized,
          unread,
          telegramLink: links.byConversation.get(conversation.id) ?? null,
          isActiveForTelegram: links.activeIds.has(conversation.id),
        }
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
    // Attachment rows go via the FK CASCADE; the bytes on disk don't,
    // so unlink the per-conversation directory explicitly before
    // dropping the conv row.
    await removeConversationAttachments(id)
    await getDb().delete(conversations).where(eq(conversations.id, id)).run()
    return c.json({ ok: true })
  })
  // Rename / pin / tuple update. Telegram-origin conversations are
  // accepted too — once they're surfaced in the sidebar they're just
  // conversations from the user's POV.
  .patch('/chat/:id', zValidator('json', patchSchema), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    if (body.agentId !== undefined) {
      const agentError = await validateAgentId(body.agentId)
      if (agentError) return c.json({ error: agentError }, 400)
    }
    const conv = await getDb()
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .get()
    if (!conv) return c.json({ error: 'conversation not found' }, 404)
    await getDb()
      .update(conversations)
      .set(buildPatchUpdate(body))
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
      const agentError = await validateAgentId(body.agentId)
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

      const tuple = mergeSendTuple(body, conv)

      const attachmentRows = await loadConvAttachments(id, body.attachmentIds)
      if (attachmentRows === null) {
        return c.json({ error: 'one or more attachment ids are invalid' }, 400)
      }

      const session = await getSessionManager().getOrCreate(id)
      const result = await session.appendUserMessage(
        body.text,
        tuple,
        attachmentRows,
      )

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
  // Hands a user's approval / denial back to the in-flight
  // onPermissionRequest callback that's awaiting in permission-registry.
  // 409 when the requestId is unknown — either a double-click race
  // (the registry entry was already drained) or a turn.cancel beat us.
  .post(
    '/chat/:id/permission/:requestId',
    zValidator('json', permissionDecisionSchema),
    async (c) => {
      const id = c.req.param('id')
      const requestId = c.req.param('requestId')
      const { outcome } = c.req.valid('json')
      const ok = resolvePermission(id, requestId, { outcome })
      if (!ok) return c.json({ error: 'request not pending' }, 409)
      return c.json({ ok: true })
    },
  )
  .get('/chat/:id/stream', (c) => {
    const id = c.req.param('id')
    const after = parseAfter(
      c.req.header('Last-Event-ID') ?? c.req.query('after'),
    )
    return streamSSE(c, (stream) => runChatStream(stream, id, after))
  })
