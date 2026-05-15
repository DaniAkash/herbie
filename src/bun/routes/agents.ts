import { homedir } from 'node:os'
import { Hono } from 'hono'
import { getOrDiscoverCapabilities } from '../agents/agent-capabilities'
import { detectAcpAgents } from '../agents/detect'
import { validateAgentId } from '../agents/registry'
import { readSettings } from './settings'

export const agentsRoute = new Hono()
  .get('/agents', async (c) => {
    const rows = await detectAcpAgents()
    return c.json(rows)
  })
  .get('/agents/:id/capabilities', async (c) => {
    const id = c.req.param('id')
    // `:id` is client-controlled, so an unknown id needs to surface
    // as a 4xx — not as the 500 that the registry's resolve-throw
    // would otherwise produce.
    const agentError = await validateAgentId(id)
    if (agentError) return c.json({ error: agentError }, 400)
    // Probe runs in the user's default workspace so the agent doesn't
    // accidentally start exploring an unrelated cwd.
    const settings = await readSettings()
    const cwd = settings.composer.workspaces.default || homedir()
    try {
      const caps = await getOrDiscoverCapabilities(id, cwd)
      return c.json(caps)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })
