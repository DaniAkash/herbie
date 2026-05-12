import { zValidator } from '@hono/zod-validator'
import { asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { conversations } from '../../db/schema/conversations.sql'
import { INBOX_STATUSES, inboxItems } from '../../db/schema/inbox-items.sql'
import { taskRunEvents } from '../../db/schema/task-run-events.sql'
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
  // Seeds a new chat conversation from a scheduled-task run by
  // copying the source run's task_run_events stream verbatim into
  // chat_events for the new conversation. The chat reducer then
  // replays the FULL transcript — user prompt, reasoning, tool
  // calls, tool results, the agent's eventual response — same way
  // it would for a live chat. The user can pick up where the task
  // left off and the agent gets the prior conversation back via
  // `rebuildMessagesFromLog` on the first follow-up turn (same
  // mechanism the chat side uses on a tuple switch).
  //
  // For tool-source rows (the agent delivered via
  // mcp__herbie__task_result), the event stream may contain only
  // the tool.call / tool.result frames with no `assistant.text`.
  // `rebuildMessagesFromLog` only projects user + assistant.text,
  // so without a synthetic assistant.text the agent's rebuild
  // would see only the user prompt and have no record of what it
  // produced. Inject one carrying the markdown right before
  // turn.finish so both the chat reducer's UI and the rebuild path
  // see a proper assistant turn.
  .post('/inbox/:id/open-in-chat', async (c) => {
    const id = c.req.param('id')
    const item = await getDb()
      .select()
      .from(inboxItems)
      .where(eq(inboxItems.id, id))
      .get()
    if (!item) return c.json({ error: 'inbox item not found' }, 404)

    const conversationId = nanoid()
    const now = new Date()

    // Source events from the originating task run, in seq order.
    const sourceEvents = await getDb()
      .select()
      .from(taskRunEvents)
      .where(eq(taskRunEvents.runId, item.taskRunId))
      .orderBy(asc(taskRunEvents.seq))
      .all()

    // Decide whether we need to synthesise an assistant.text for the
    // markdown brief. Tool-source rows almost always lack one (the
    // agent went straight to the tool call); text-source rows
    // already carry assistant.text frames.
    const needsSyntheticAssistant =
      item.bodySource === 'tool' && item.body.length > 0
    // Pull the requestId off the first turn.start so the synthetic
    // event is correlated with the same turn.
    let turnRequestId: string | null = null
    for (const ev of sourceEvents) {
      if (ev.type !== 'turn.start') continue
      try {
        const p = JSON.parse(ev.payload) as { requestId?: string }
        if (typeof p.requestId === 'string') {
          turnRequestId = p.requestId
          break
        }
      } catch {
        /* ignore — fall back to nanoid below */
      }
    }
    const requestId = turnRequestId ?? nanoid(8)

    const copied: Array<typeof chatEvents.$inferInsert> = []
    let nextSeq = 0
    for (const ev of sourceEvents) {
      // Inject the synthetic assistant.text immediately before the
      // first turn.finish event. If the run terminated via
      // turn.cancel / turn.error we skip — partial briefs aren't
      // canonical enough to seed as the previous assistant message.
      if (needsSyntheticAssistant && ev.type === 'turn.finish') {
        copied.push({
          conversationId,
          seq: nextSeq++,
          type: 'assistant.text',
          payload: JSON.stringify({
            requestId,
            textId: nanoid(),
            text: item.body,
          }),
          createdAt: ev.createdAt,
        })
      }
      copied.push({
        conversationId,
        seq: nextSeq++,
        type: ev.type,
        payload: ev.payload,
        createdAt: ev.createdAt,
      })
    }

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

      if (copied.length > 0) {
        await tx.insert(chatEvents).values(copied).run()
      }

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
