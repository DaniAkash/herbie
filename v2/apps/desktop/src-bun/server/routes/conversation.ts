import { subscribe } from '@bun/modules/conversation/bus'
import { isPending } from '@bun/modules/conversation/pending'
import { decide } from '@bun/modules/conversation/permissions'
import {
  liveSession,
  sessionFor,
  target,
} from '@bun/modules/conversation/sessions'
import { openTranscript } from '@bun/modules/conversation/transcript'
import {
  answer,
  cancelTurn,
  liveTurn,
  startTurn,
  TurnInProgressError,
} from '@bun/modules/conversation/turns'
import { agents } from '@bun/modules/db/schema/schema'
import type { Deps } from '@bun/server/deps'
import {
  afterQuery,
  answersBody,
  cancelBody,
  decisionBody,
  turnBody,
} from '@bun/shared/schemas'
import type { TranscriptRecord } from '@bun/shared/transcript'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

/**
 * The conversation, as six routes on an agent.
 *
 * Mounted alongside the agents router rather than inside it: the two have no
 * handler in common and one file holding both would be the longest in the
 * sidecar. Chained, because Hono builds the RPC types from the chain.
 */

/** Reading a thread needs the folder it is in, and nothing else. */
function threadOf(deps: Deps, agentId: string) {
  const agent = deps.db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .get()
  if (!agent) return null
  return openTranscript(agent.workspaceDir)
}

export function conversationRoute(deps: Deps) {
  return (
    new Hono()
      .post('/:id/turns', zValidator('json', turnBody), (c) => {
        try {
          const { turnId } = startTurn(
            deps.db,
            c.req.param('id'),
            c.req.valid('json').text,
          )
          // 202 rather than 200: the turn was accepted, and what it produces
          // arrives over the stream as the agent reports it.
          return c.json({ turnId }, 202)
        } catch (cause) {
          if (cause instanceof TurnInProgressError) {
            return c.json({ error: 'busy', turnId: cause.turnId }, 409)
          }
          if (cause instanceof Error && cause.message === 'no such agent') {
            return c.json({ error: 'no such agent' }, 404)
          }
          throw cause
        }
      })

      .post('/:id/turns/cancel', zValidator('json', cancelBody), (c) => {
        const stopped = cancelTurn(
          c.req.param('id'),
          c.req.valid('json').reason,
        )
        return c.json({ cancelled: stopped })
      })

      .post('/:id/answers/:recordId', zValidator('json', answersBody), (c) => {
        const given = answer(
          deps.db,
          c.req.param('id'),
          c.req.param('recordId'),
          c.req.valid('json').answers,
        )
        // 409 rather than 200 on a second submission, so a double click on
        // Send does not leave the person believing they answered twice.
        if (!given) return c.json({ error: 'not pending' }, 409)
        return c.json({ answered: true })
      })

      .post(
        '/:id/permissions/:requestId',
        zValidator('json', decisionBody),
        (c) => {
          const agentId = c.req.param('id')
          const session = liveSession(agentId)
          if (!session) return c.json({ error: 'not pending' }, 409)
          const { optionId, recordId } = c.req.valid('json')
          const settled = decide(
            deps.db,
            target(session),
            c.req.param('requestId'),
            recordId,
            optionId,
          )
          if (!settled) return c.json({ error: 'not pending' }, 409)
          return c.json({ decided: true })
        },
      )

      .get('/:id/transcript', zValidator('query', afterQuery), (c) => {
        const agentId = c.req.param('id')
        const thread = threadOf(deps, agentId)
        if (!thread) return c.json({ error: 'no such agent' }, 404)
        const after = c.req.valid('query').after ?? -1
        const records = thread.read(after)
        return c.json({
          records,
          lastSeq: thread.lastSeq,
          live: liveTurn(agentId),
        })
      })

      /**
       * The same records, pushed.
       *
       * Replay then live, with an `after` cursor, lifted from v1 because it has
       * been right since it shipped: the bus is subscribed to before the disk
       * is read, and what arrives during the read is buffered and drained
       * afterwards against the last replayed sequence number. A subscriber that
       * connects mid-turn sees the in-flight thread rather than joining late.
       */
      .get('/:id/stream', zValidator('query', afterQuery), (c) => {
        const agentId = c.req.param('id')
        const thread = threadOf(deps, agentId)
        if (!thread) return c.json({ error: 'no such agent' }, 404)
        const after = c.req.valid('query').after ?? -1

        return streamSSE(c, async (stream) => {
          const buffered: TranscriptRecord[] = []
          let replaying = true

          const send = (record: TranscriptRecord) =>
            stream
              .writeSSE({
                id: String(record.seq),
                event: 'record',
                data: JSON.stringify(record),
              })
              .catch(() => {
                // The connection went away mid-write. onAbort unsubscribes.
              })

          const unsubscribe = subscribe(agentId, (signal) => {
            // A turn update is telemetry about the turn in flight, not part
            // of the thread, so it is never buffered against the replay
            // cursor: there is nothing to dedupe it against.
            if (signal.type === 'turn') {
              void stream.writeSSE({
                event: 'turn',
                data: JSON.stringify(signal.live),
              })
              return
            }
            if (replaying) buffered.push(signal.record)
            else void send(signal.record)
          })
          stream.onAbort(unsubscribe)

          // The live turn goes first, so a reconnect past the turn.start record
          // still knows a turn is running and draws the indicator.
          await stream.writeSSE({
            event: 'turn',
            data: JSON.stringify(liveTurn(agentId)),
          })

          let last = after
          for (const record of thread.read(after)) {
            if (stream.aborted || stream.closed) return
            await send(record)
            last = record.seq
          }

          replaying = false
          for (const record of buffered) {
            if (record.seq > last) await send(record)
          }
          buffered.length = 0

          await new Promise<void>((resolve) => stream.onAbort(resolve))
        })
      })

      /**
       * Whether a block is still waiting on the person.
       *
       * Asked rather than inferred from the record, because the record is
       * append-only and says only that it was pending when it was written. A
       * restart drops what was waiting, so a question from before it is
       * answerable-looking and dead, and the card needs to know which.
       */
      .get('/:id/pending/:key', (c) =>
        c.json({ pending: isPending(c.req.param('id'), c.req.param('key')) }),
      )

      /** Opens the session without sending anything, so the first turn is warm. */
      .post('/:id/session', (c) => {
        const agent = deps.db
          .select()
          .from(agents)
          .where(eq(agents.id, c.req.param('id')))
          .get()
        if (!agent) return c.json({ error: 'no such agent' }, 404)
        const session = sessionFor(deps.db, agent)
        return c.json({ version: session.version })
      })
  )
}
