import { toCron } from '@bun/modules/routines/cadence'
import { cadenceBody } from '@bun/shared/schemas'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

/**
 * Reads a cadence without committing to it.
 *
 * The new routine sheet shows what it understood while you are still typing,
 * and it is the same parse the routine will be stored with. Doing it here
 * rather than in the webview is what stops the two from disagreeing.
 */
export const cadenceRoute = new Hono().post(
  '/',
  zValidator('json', cadenceBody),
  (c) => c.json({ cadence: toCron(c.req.valid('json').text) }),
)
