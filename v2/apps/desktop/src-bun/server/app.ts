import type { Deps } from '@bun/server/deps'
import { agentsRoute } from '@bun/server/routes/agents'
import { cadenceRoute } from '@bun/server/routes/cadence'
import { healthRoute } from '@bun/server/routes/health'
import { routinesRoute } from '@bun/server/routes/routines'
import { rulesRoute } from '@bun/server/routes/rules'
import { runtimesRoute } from '@bun/server/routes/runtimes'
import { statusRoute } from '@bun/server/routes/status'
import { toolsRoute } from '@bun/server/routes/tools'
import { Hono } from 'hono'

/**
 * The route tree. Its type is the whole contract the webview compiles against.
 *
 * Routes are chained rather than registered in statements, because Hono builds
 * its RPC types from the chain. An `app.route(...)` on its own line types as
 * a bare `Hono` and the client loses every path it was supposed to know about.
 */
export function createApp(deps: Deps) {
  return new Hono()
    .basePath('/api')
    .route('/health', healthRoute)
    .route('/status', statusRoute(deps))
    .route('/agents', agentsRoute(deps))
    .route('/tools', toolsRoute(deps))
    .route('/runtimes', runtimesRoute(deps))
    .route('/routines', routinesRoute(deps))
    .route('/rules', rulesRoute(deps))
    .route('/cadence', cadenceRoute)
}

export type AppType = ReturnType<typeof createApp>
