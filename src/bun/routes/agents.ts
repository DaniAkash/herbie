import { Hono } from 'hono'
import { detectAcpAgents } from '../agents/detect'

export const agentsRoute = new Hono().get('/agents', async (c) => {
  const rows = await detectAcpAgents()
  return c.json(rows)
})
