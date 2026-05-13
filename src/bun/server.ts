import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { agentsRoute } from './routes/agents'
import { chatRoute } from './routes/chat'
import { inboxRoute } from './routes/inbox'
import { internalRoute } from './routes/internal'
import { settingsRoute } from './routes/settings'
import { skillsRoute } from './routes/skills'
import { systemRoute } from './routes/system'
import { tasksRoute } from './routes/tasks'
import { telegramRoute } from './routes/telegram'

const app = new Hono()
// The API binds to 127.0.0.1 only (see src/bun/index.ts), so it's
// reachable solely from the same machine — wildcard CORS is safe here.
// Hardcoding `http://localhost:5173` worked in dev but blocked the
// packaged renderer, which loads from views:// and sends a different
// Origin header (or `null`) that no fixed allowlist can cover cleanly.
app.use('*', cors({ origin: '*' }))

const routes = app
  .get('/health', (c) => c.json({ status: 'ok' }))
  .route('/', settingsRoute)
  .route('/', agentsRoute)
  .route('/', systemRoute)
  .route('/', chatRoute)
  .route('/', tasksRoute)
  .route('/', inboxRoute)
  .route('/', internalRoute)
  .route('/', skillsRoute)
  .route('/', telegramRoute)

export type AppType = typeof routes
export default routes
