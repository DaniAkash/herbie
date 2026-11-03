import type { Db } from '@bun/modules/db/db'
import { agents, mcpServers, skills } from '@bun/modules/db/schema/schema'
import { setServerAccess } from '@bun/modules/tools/linking'
import { setSkillAccess } from '@bun/modules/tools/skills'
import { eq } from 'drizzle-orm'

export interface ApplyAccess {
  readonly agentId: string
  readonly kind: 'server' | 'skill'
  readonly refId: string
  readonly enabled: boolean
  readonly skillsWorkspace: string
}

/**
 * Writes a switch through to the runtime's own config.
 *
 * Separate from the route because the row and the file are two different
 * promises: the row records what was asked for and always lands, while the
 * file can fail on a runtime whose format this build does not know. What
 * comes back is the reason, for the row to carry, not an error.
 */
export async function applyAccess(
  db: Db,
  input: ApplyAccess,
): Promise<string | null> {
  const agent = db
    .select()
    .from(agents)
    .where(eq(agents.id, input.agentId))
    .get()
  if (!agent) return null

  if (input.kind === 'server') {
    const server = db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, input.refId))
      .get()
    if (!server) return null
    const result = await setServerAccess({
      runtimeId: agent.acpAgent,
      workspaceDir: agent.workspaceDir,
      server,
      enabled: input.enabled,
    })
    return result.linked ? null : (result.reason ?? null)
  }

  const skill = db.select().from(skills).where(eq(skills.id, input.refId)).get()
  if (!skill) return null
  const result = await setSkillAccess({
    runtimeId: agent.acpAgent,
    workspaceDir: agent.workspaceDir,
    skillsWorkspace: input.skillsWorkspace,
    skillName: skill.name,
    enabled: input.enabled,
  })
  return result.linked ? null : (result.reason ?? null)
}
