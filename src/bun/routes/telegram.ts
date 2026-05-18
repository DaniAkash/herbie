import { zValidator } from '@hono/zod-validator'
import { desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { conversations } from '../../db/schema/conversations.sql'
import { telegramChats } from '../../db/schema/telegram-chats.sql'
import {
  type TelegramConnection,
  telegramConnections,
} from '../../db/schema/telegram-connections.sql'
import { validateAgentId } from '../agents/registry'
import { getDb } from '../db-singleton'
import { encryptSecret } from '../security/secrets'
import { type ValidatedBot, validateBotToken } from '../telegram/api'
import { getTelegramManager } from '../telegram/manager'
import {
  createConnectionSchema,
  updateConnectionSchema,
} from './telegram.schemas'

// botTokenEncrypted is intentionally omitted from the wire shape.
function serializeConnection(row: TelegramConnection) {
  return {
    id: row.id,
    name: row.name,
    botUsername: row.botUsername,
    agentId: row.agentId,
    modelId: row.modelId,
    workspacePath: row.workspacePath,
    reasoningEffort: row.reasoningEffort,
    status: row.status,
    lastError: row.lastError,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

export const telegramRoute = new Hono()
  .get('/telegram/connections', async (c) => {
    const rows = await getDb()
      .select()
      .from(telegramConnections)
      .orderBy(desc(telegramConnections.updatedAt))
      .all()
    return c.json(rows.map(serializeConnection))
  })
  // Sidebar feed: returns the External Chats → Telegram → @bot → chat
  // nest in one shot. Grouped by connection, sorted by recency, with
  // an unreadCount (chat_events.createdAt > conversations.lastSeenAt)
  // per chat for the badge.
  .get('/telegram/chats', async (c) => {
    const db = getDb()
    const connectionRows = await db
      .select()
      .from(telegramConnections)
      .orderBy(desc(telegramConnections.updatedAt))
      .all()
    if (connectionRows.length === 0) return c.json([])

    const chatRows = await db
      .select({
        id: telegramChats.id,
        connectionId: telegramChats.connectionId,
        telegramChatId: telegramChats.telegramChatId,
        chatKind: telegramChats.chatKind,
        chatTitle: telegramChats.chatTitle,
        conversationId: telegramChats.conversationId,
        conversationTitle: conversations.title,
        updatedAt: conversations.updatedAt,
        lastSeenAt: conversations.lastSeenAt,
        archivedAt: conversations.archivedAt,
        // Subquery for unread count. NULL lastSeenAt means "never
        // seen" → count every event.
        unreadCount: sql<number>`(
          SELECT COUNT(*) FROM ${chatEvents}
          WHERE ${chatEvents.conversationId} = ${conversations.id}
            AND (${conversations.lastSeenAt} IS NULL
                 OR ${chatEvents.createdAt} > ${conversations.lastSeenAt})
        )`,
      })
      .from(telegramChats)
      .innerJoin(
        conversations,
        eq(conversations.id, telegramChats.conversationId),
      )
      .where(isNull(conversations.archivedAt))
      .orderBy(desc(conversations.updatedAt))
      .all()

    const byConnection = new Map<string, typeof chatRows>()
    for (const row of chatRows) {
      const list = byConnection.get(row.connectionId) ?? []
      list.push(row)
      byConnection.set(row.connectionId, list)
    }

    return c.json(
      connectionRows.map((conn) => ({
        connection: {
          id: conn.id,
          name: conn.name,
          botUsername: conn.botUsername,
          status: conn.status,
        },
        chats: (byConnection.get(conn.id) ?? []).map((r) => ({
          id: r.id,
          conversationId: r.conversationId,
          telegramChatId: r.telegramChatId,
          chatKind: r.chatKind,
          chatTitle: r.chatTitle,
          conversationTitle: r.conversationTitle,
          updatedAt: r.updatedAt.getTime(),
          unreadCount: Number(r.unreadCount),
        })),
      })),
    )
  })
  .get('/telegram/connections/workspace-in-use', async (c) => {
    const path = c.req.query('path')
    if (!path) return c.json({ inUseBy: null })
    const row = await getDb()
      .select()
      .from(telegramConnections)
      .where(eq(telegramConnections.workspacePath, path))
      .get()
    if (!row) return c.json({ inUseBy: null })
    return c.json({
      inUseBy: { id: row.id, name: row.name },
    })
  })
  .post(
    '/telegram/connections',
    zValidator('json', createConnectionSchema),
    async (c) => {
      const body = c.req.valid('json')
      const agentError = await validateAgentId(body.agentId)
      if (agentError) return c.json({ error: agentError }, 400)
      let botInfo: ValidatedBot
      try {
        botInfo = await validateBotToken(body.botToken)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return c.json({ error: message }, 400)
      }
      const now = new Date()
      const row = {
        id: nanoid(),
        name: body.name,
        botUsername: botInfo.username,
        botTokenEncrypted: await encryptSecret(body.botToken),
        agentId: body.agentId,
        modelId: body.modelId ?? null,
        workspacePath: body.workspacePath,
        reasoningEffort: body.reasoningEffort ?? null,
        status: 'active' as const,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }
      await getDb().insert(telegramConnections).values(row).run()
      void getTelegramManager().start(row)
      return c.json(serializeConnection(row))
    },
  )
  .patch(
    '/telegram/connections/:id',
    zValidator('json', updateConnectionSchema),
    async (c) => {
      const id = c.req.param('id')
      const body = c.req.valid('json')
      const current = await getDb()
        .select()
        .from(telegramConnections)
        .where(eq(telegramConnections.id, id))
        .get()
      if (!current) return c.json({ error: 'connection not found' }, 404)

      let nextTokenEncrypted = current.botTokenEncrypted
      let nextUsername = current.botUsername
      if (body.botToken) {
        try {
          const info = await validateBotToken(body.botToken)
          nextTokenEncrypted = await encryptSecret(body.botToken)
          nextUsername = info.username
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return c.json({ error: message }, 400)
        }
      }

      const next: TelegramConnection = {
        ...current,
        name: body.name ?? current.name,
        botTokenEncrypted: nextTokenEncrypted,
        botUsername: nextUsername,
        updatedAt: new Date(),
      }
      await getDb()
        .update(telegramConnections)
        .set({
          name: next.name,
          botTokenEncrypted: next.botTokenEncrypted,
          botUsername: next.botUsername,
          updatedAt: next.updatedAt,
        })
        .where(eq(telegramConnections.id, id))
        .run()

      // Token change requires a bot restart so the polling loop picks
      // up the new credential. A rename alone doesn't.
      if (body.botToken && current.status === 'active') {
        void getTelegramManager().restart(next)
      }
      return c.json(serializeConnection(next))
    },
  )
  .delete('/telegram/connections/:id', async (c) => {
    const id = c.req.param('id')
    const current = await getDb()
      .select()
      .from(telegramConnections)
      .where(eq(telegramConnections.id, id))
      .get()
    if (!current) return c.json({ error: 'connection not found' }, 404)
    await getTelegramManager().stop(id)

    // Mark every conversation tied to this connection as archived so
    // the sidebar hides it. chat_events stay on disk for future
    // archive-browsing UI. The telegram_chats mapping rows themselves
    // get dropped by ON DELETE CASCADE when the connection row goes.
    const mappedConversationIds = (
      await getDb()
        .select({ id: telegramChats.conversationId })
        .from(telegramChats)
        .where(eq(telegramChats.connectionId, id))
        .all()
    ).map((r) => r.id)
    if (mappedConversationIds.length > 0) {
      const now = new Date()
      await getDb()
        .update(conversations)
        .set({ archivedAt: now, updatedAt: now })
        .where(inArray(conversations.id, mappedConversationIds))
        .run()
    }

    await getDb()
      .delete(telegramConnections)
      .where(eq(telegramConnections.id, id))
      .run()
    return c.json({ ok: true })
  })
  .post('/telegram/connections/:id/pause', async (c) => {
    const id = c.req.param('id')
    const current = await getDb()
      .select()
      .from(telegramConnections)
      .where(eq(telegramConnections.id, id))
      .get()
    if (!current) return c.json({ error: 'connection not found' }, 404)
    await getTelegramManager().stop(id)
    await getDb()
      .update(telegramConnections)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(telegramConnections.id, id))
      .run()
    const updated: TelegramConnection = {
      ...current,
      status: 'paused',
      updatedAt: new Date(),
    }
    return c.json(serializeConnection(updated))
  })
  .post('/telegram/connections/:id/resume', async (c) => {
    const id = c.req.param('id')
    const current = await getDb()
      .select()
      .from(telegramConnections)
      .where(eq(telegramConnections.id, id))
      .get()
    if (!current) return c.json({ error: 'connection not found' }, 404)
    const updated: TelegramConnection = {
      ...current,
      status: 'active',
      lastError: null,
      updatedAt: new Date(),
    }
    await getDb()
      .update(telegramConnections)
      .set({
        status: 'active',
        lastError: null,
        updatedAt: updated.updatedAt,
      })
      .where(eq(telegramConnections.id, id))
      .run()
    void getTelegramManager().start(updated)
    return c.json(serializeConnection(updated))
  })
  .get('/telegram/connections/:id/status', async (c) => {
    const id = c.req.param('id')
    const status = getTelegramManager().getStatus(id)
    return c.json({ runtime: status })
  })
