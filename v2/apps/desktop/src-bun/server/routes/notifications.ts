import {
  reportPresence,
  resetPresence,
} from '@bun/modules/notifications/presence'
import {
  listNotifications,
  markDismissed,
  markSeen,
  seeAgent,
  unseenAgents,
} from '@bun/modules/notifications/store'
import { type AppSignal, subscribeApp } from '@bun/modules/notifications/stream'
import type { Deps } from '@bun/server/deps'
import { presenceBody } from '@bun/shared/schemas'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

/**
 * The inbox, and the one stream that is not tied to an agent.
 *
 * The conversation stream is per agent and open only for the agent on
 * screen, so everything this module has to say would be invisible to the
 * window. This is the channel that reaches it whatever is on screen.
 */
export function notificationsRoute(deps: Deps) {
  return (
    new Hono()
      .get('/', (c) =>
        c.json({
          notifications: listNotifications(deps.db),
          waiting: unseenAgents(deps.db),
        }),
      )

      .get('/stream', (c) =>
        streamSSE(c, async (stream) => {
          const send = (signal: AppSignal) =>
            stream
              .writeSSE({ event: signal.type, data: JSON.stringify(signal) })
              .catch(() => {
                // Gone mid write. onAbort unsubscribes.
              })

          const unsubscribe = subscribeApp((signal) => void send(signal))
          stream.onAbort(unsubscribe)

          await new Promise<void>((resolve) => stream.onAbort(resolve))
        }),
      )

      .post('/:id/seen', (c) => {
        markSeen(deps.db, c.req.param('id'))
        return c.json({ seen: true })
      })

      .post('/:id/dismissed', (c) => {
        markDismissed(deps.db, c.req.param('id'))
        return c.json({ dismissed: true })
      })

      /**
       * The person opened that agent's thread.
       *
       * The strongest seen signal there is, and the one the window reports
       * rather than the person clicking anything.
       */
      .post('/agents/:agentId/seen', (c) => {
        seeAgent(deps.db, c.req.param('agentId'))
        return c.json({ seen: true })
      })
  )
}

/**
 * What the window is showing, which no other process can know.
 *
 * Held in memory and never written down: it describes a renderer that is
 * running right now, and a value outliving the process that reported it
 * would be worse than no value at all.
 */
export function presenceRoute() {
  return new Hono()
    .post('/', zValidator('json', presenceBody), (c) => {
      const body = c.req.valid('json')
      reportPresence({
        focused: body.focused,
        agentId: body.agentId ?? null,
        at: Date.now(),
      })
      return c.json({ ok: true })
    })
    .delete('/', (c) => {
      resetPresence()
      return c.json({ ok: true })
    })
}
