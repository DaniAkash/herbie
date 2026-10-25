import { Hono } from 'hono'

/**
 * The one route that is reachable without the bearer token.
 *
 * A caller that cannot authenticate still needs a way to tell "the sidecar is
 * up but I have the wrong token" from "the sidecar is not there", and a 401 on
 * every path collapses those two into one symptom.
 */
export const healthRoute = new Hono().get('/', (c) =>
  c.json({ status: 'ok' as const, pid: process.pid }),
)
