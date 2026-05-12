import { zValidator } from '@hono/zod-validator'
import {
  ForeignPathError,
  SkillNotFoundError,
  SourceParseError,
} from 'agent-skills-manager'
import { Hono } from 'hono'
import type { z } from 'zod'
import { fromSkillsAgent, toSkillsAgent } from '../skills/agent-id-map'
import { getSkillsManager } from '../skills/skillsManager'
import {
  addBodySchema,
  HERBIE_SKILLS_AGENT_ENUM,
  linkBodySchema,
  rescanBodySchema,
} from './skills.schema'

type HerbieSkillsAgent = z.infer<typeof HERBIE_SKILLS_AGENT_ENUM>

async function snapshot() {
  const mgr = getSkillsManager()
  const [rawSkills, rawLinks] = await Promise.all([
    mgr.listSkills(),
    mgr.listLinks(),
  ])
  return {
    skills: rawSkills.map((s) => ({
      name: s.name,
      description: s.description,
      workspacePath: s.workspacePath,
      ...(s.source ? { source: s.source } : {}),
      ...(s.addedAt ? { addedAt: s.addedAt } : {}),
      ...(s.broken ? { broken: true as const } : {}),
    })),
    links: rawLinks.flatMap((l) => {
      const herbieAgent = fromSkillsAgent(l.agent)
      // Drop upstream-only agents that don't map to a Herbie agent — the
      // UI only renders claude / codex / gemini chips today.
      if (!herbieAgent) return []
      return [
        {
          skillName: l.skillName,
          agent: herbieAgent,
          linkPath: l.linkPath,
          ...(l.broken ? { broken: true as const } : {}),
        },
      ]
    }),
  }
}

export const skillsRoute = new Hono()
  .get('/skills', async (c) => {
    return c.json(await snapshot())
  })
  .post('/skills', zValidator('json', addBodySchema), async (c) => {
    const { source, skillNames } = c.req.valid('json')
    try {
      const result = await getSkillsManager().add({ source, skillNames })
      return c.json({
        added: result.added,
        skipped: result.skipped,
        failed: result.failed,
        ...(await snapshot()),
      })
    } catch (err) {
      if (err instanceof SourceParseError) {
        return c.json({ error: err.message }, 400)
      }
      throw err
    }
  })
  .delete('/skills/:name', async (c) => {
    const name = c.req.param('name')
    const withLinks = c.req.query('with-links') !== 'false'
    try {
      if (withLinks) {
        await getSkillsManager().removeWithLinks({ skillName: name })
      } else {
        await getSkillsManager().remove({ skillName: name })
      }
      return c.json(await snapshot())
    } catch (err) {
      if (err instanceof SkillNotFoundError) {
        return c.json({ error: err.message }, 404)
      }
      throw err
    }
  })
  .post(
    '/skills/:name/links',
    zValidator('json', linkBodySchema),
    async (c) => {
      const name = c.req.param('name')
      const { agent } = c.req.valid('json')
      const skillsAgent = toSkillsAgent(agent)
      if (!skillsAgent) {
        return c.json({ error: `Agent ${agent} does not support skills.` }, 400)
      }
      try {
        const result = await getSkillsManager().link({
          skillName: name,
          agent: skillsAgent,
        })
        return c.json({
          created: result.created,
          linkPath: result.linkPath,
          ...(await snapshot()),
        })
      } catch (err) {
        if (err instanceof ForeignPathError) {
          return c.json({ error: err.message }, 409)
        }
        if (err instanceof SkillNotFoundError) {
          return c.json({ error: err.message }, 404)
        }
        throw err
      }
    },
  )
  .delete('/skills/:name/links/:agent', async (c) => {
    const name = c.req.param('name')
    const parsed = HERBIE_SKILLS_AGENT_ENUM.safeParse(c.req.param('agent'))
    if (!parsed.success) {
      return c.json({ error: 'Unknown agent.' }, 400)
    }
    const agent: HerbieSkillsAgent = parsed.data
    const skillsAgent = toSkillsAgent(agent)
    if (!skillsAgent) {
      return c.json({ error: `Agent ${agent} does not support skills.` }, 400)
    }
    const result = await getSkillsManager().unlink({
      skillName: name,
      agent: skillsAgent,
    })
    return c.json({
      removed: result.removed,
      ...(result.foreign ? { foreign: true as const } : {}),
      ...(result.unmanaged ? { unmanaged: true as const } : {}),
      ...(await snapshot()),
    })
  })
  .post('/skills/rescan', zValidator('json', rescanBodySchema), async (c) => {
    const body = c.req.valid('json') ?? { mode: 'merge' as const }
    const result = await getSkillsManager().rescan({ mode: body.mode })
    return c.json({ ...result, ...(await snapshot()) })
  })
