import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { agentsRoute } from './routes/agents'
import { appSettingsRoute } from './routes/appSettings'
import { systemRoute } from './routes/system'

const app = new Hono()
// The API binds to 127.0.0.1 only (see src/bun/index.ts), so it's
// reachable solely from the same machine — wildcard CORS is safe here.
// Hardcoding `http://localhost:5173` worked in dev but blocked the
// packaged renderer, which loads from views:// and sends a different
// Origin header (or `null`) that no fixed allowlist can cover cleanly.
app.use('*', cors({ origin: '*' }))

const routes = app
  .get('/health', (c) => c.json({ status: 'ok' }))
  .route('/', appSettingsRoute)
  .route('/', agentsRoute)
  .route('/', systemRoute)

export type AppType = typeof routes
export default routes
