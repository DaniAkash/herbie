import { zValidator } from '@hono/zod-validator'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { conversations } from '../../db/schema/conversations.sql'
import { INBOX_STATUSES, inboxItems } from '../../db/schema/inbox-items.sql'
import { getDb } from '../db-singleton'

type InboxRow = typeof inboxItems.$inferSelect

function serialize(row: InboxRow) {
  return {
    ...row,
    createdAt: row.createdAt.getTime(),
  }
}

const patchSchema = z
  .object({
    status: z.enum(INBOX_STATUSES).optional(),
    starred: z.boolean().optional(),
  })
  .strict()

export const inboxRoute = new Hono()
  .get('/inbox', async (c) => {
    const rows = await getDb()
      .select()
      .from(inboxItems)
      .orderBy(desc(inboxItems.createdAt))
      .all()
    return c.json(rows.map(serialize))
  })
  .get('/inbox/:id', async (c) => {
    const id = c.req.param('id')
    const row = await getDb()
      .select()
      .from(inboxItems)
      .where(eq(inboxItems.id, id))
      .get()
    if (!row) return c.json({ error: 'inbox item not found' }, 404)
    return c.json(serialize(row))
  })
  .patch('/inbox/:id', zValidator('json', patchSchema), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const current = await getDb()
      .select()
      .from(inboxItems)
      .where(eq(inboxItems.id, id))
      .get()
    if (!current) return c.json({ error: 'inbox item not found' }, 404)
    const next = {
      status: body.status ?? current.status,
      starred: body.starred ?? current.starred,
    }
    await getDb()
      .update(inboxItems)
      .set(next)
      .where(eq(inboxItems.id, id))
      .run()
    return c.json(serialize({ ...current, ...next }))
  })
  .delete('/inbox/:id', async (c) => {
    const id = c.req.param('id')
    const r = await getDb()
      .delete(inboxItems)
      .where(eq(inboxItems.id, id))
      .run()
    if (r.rowsAffected === 0)
      return c.json({ error: 'inbox item not found' }, 404)
    return c.json({ ok: true })
  })
  // Seeds a new chat conversation with the task prompt as the user's
  // first message and the inbox body as the assistant's first reply,
  // then redirects the renderer to it. The user lands mid-conversation
  // and can continue typing. The chat reducer treats the synthetic
  // events identically to live ones; same-tuple resend stays on the
  // cheap path because lastTuple is seeded from the row.
  .post('/inbox/:id/open-in-chat', async (c) => {
    const id = c.req.param('id')
    const item = await getDb()
      .select()
      .from(inboxItems)
      .where(eq(inboxItems.id, id))
      .get()
    if (!item) return c.json({ error: 'inbox item not found' }, 404)

    const conversationId = nanoid()
    const requestId = nanoid(8)
    const now = new Date()

    await getDb().transaction(async (tx) => {
      await tx
        .insert(conversations)
        .values({
          id: conversationId,
          title: `From: ${item.taskName}`,
          agentId: item.agentId,
          modelId: item.modelId,
          workspacePath: item.workspacePath,
          reasoningEffort: item.reasoningEffort,
          acpxSessionId: null,
          acpxRecordId: null,
          agentSessionId: null,
          status: 'idle',
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Seed events so the reducer renders a complete first exchange:
      // user prompt → assistant body (or error) → terminal event.
      // Without the terminal event the reducer's isStreaming would
      // stick on true and the composer would render disabled.
      //
      // Two shapes — successful runs seed assistant.text + turn.finish;
      // failed runs seed turn.error so the chat shows the same rich
      // error block the inbox card shows, instead of a blank reply.
      const isError = item.errorMessage != null
      const events = [
        {
          conversationId,
          seq: 0,
          type: 'turn.start',
          payload: JSON.stringify({
            requestId,
            userMessage: item.promptSnapshot,
            agentId: item.agentId,
            modelId: item.modelId,
            workspacePath: item.workspacePath,
            reasoningEffort: item.reasoningEffort,
          }),
          createdAt: now,
        },
        isError
          ? {
              conversationId,
              seq: 1,
              type: 'turn.error',
              payload: JSON.stringify({
                requestId,
                message: item.errorMessage,
                code: item.errorCode ?? undefined,
                details: item.errorDetails ?? undefined,
              }),
              createdAt: now,
            }
          : {
              conversationId,
              seq: 1,
              type: 'assistant.text',
              payload: JSON.stringify({
                requestId,
                textId: nanoid(),
                text: item.body,
              }),
              createdAt: now,
            },
      ]
      if (!isError) {
        events.push({
          conversationId,
          seq: 2,
          type: 'turn.finish',
          payload: JSON.stringify({
            requestId,
            finishReason: 'stop',
          }),
          createdAt: now,
        })
      }
      await tx.insert(chatEvents).values(events).run()

      // Mark read since the user explicitly engaged with this card.
      if (item.status === 'unread') {
        await tx
          .update(inboxItems)
          .set({ status: 'read' })
          .where(eq(inboxItems.id, id))
          .run()
      }
    })

    return c.json({ conversationId })
  })
