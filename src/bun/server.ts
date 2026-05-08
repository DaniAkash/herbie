import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { appSettingsRoute } from './routes/appSettings'

const app = new Hono()
app.use('*', cors({ origin: 'http://localhost:5173' }))

const routes = app
  .get('/health', (c) => c.json({ status: 'ok' }))
  .route('/', appSettingsRoute)

export type AppType = typeof routes
export default routes
