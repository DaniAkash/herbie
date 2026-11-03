import type { Db } from '@bun/modules/db/db'
import {
  agents,
  agentTools,
  mcpServers,
  skills,
} from '@bun/modules/db/schema/schema'
import { setServerAccess } from '@bun/modules/tools/linking'
import { setSkillAccess } from '@bun/modules/tools/skills'
import { and, eq } from 'drizzle-orm'

export interface ApplyAccess {
  readonly agentId: string
  readonly kind: 'server' | 'skill'
  readonly refId: string
  readonly enabled: boolean
  readonly skillsWorkspace: string
}

interface WriteAccess extends Omit<ApplyAccess, 'agentId'> {
  readonly runtimeId: string
  readonly workspaceDir: string
}

/** Writes one switch into one runtime's config, named rather than looked up. */
async function writeAccess(db: Db, input: WriteAccess): Promise<string | null> {
  if (input.kind === 'server') {
    const server = db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, input.refId))
      .get()
    if (!server) return null
    const result = await setServerAccess({
      runtimeId: input.runtimeId,
      workspaceDir: input.workspaceDir,
      server,
      enabled: input.enabled,
    })
    return result.linked ? null : (result.reason ?? null)
  }

  const skill = db.select().from(skills).where(eq(skills.id, input.refId)).get()
  if (!skill) return null
  const result = await setSkillAccess({
    runtimeId: input.runtimeId,
    workspaceDir: input.workspaceDir,
    skillsWorkspace: input.skillsWorkspace,
    skillName: skill.name,
    enabled: input.enabled,
  })
  return result.linked ? null : (result.reason ?? null)
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

  return writeAccess(db, {
    ...input,
    runtimeId: agent.acpAgent,
    workspaceDir: agent.workspaceDir,
  })
}

/**
 * Moves every switch that is on from one runtime's config to another's.
 *
 * A switch is a row plus a file in one runtime's own format, so an agent that
 * changes runtime is left holding rows describing links the new runtime has
 * never heard of. A switch the new runtime will not take is turned off rather
 * than left reading as on: not every runtime has a project config this build
 * can write, and a panel saying yes over a file that does not exist is worse
 * than one saying the access went away with the runtime.
 */
export async function moveAccess(
  db: Db,
  input: { agentId: string; from: string; to: string; skillsWorkspace: string },
): Promise<void> {
  const agent = db
    .select()
    .from(agents)
    .where(eq(agents.id, input.agentId))
    .get()
  if (!agent) return

  const rows = db
    .select()
    .from(agentTools)
    .where(
      and(eq(agentTools.agentId, input.agentId), eq(agentTools.enabled, true)),
    )
    .all()

  for (const row of rows) {
    const kind = row.kind
    if (kind !== 'server' && kind !== 'skill') continue
    // `as const` because the column is plain text: without it the narrowing
    // above widens straight back to string on the way into the literal.
    const common = {
      kind,
      refId: row.refId,
      workspaceDir: agent.workspaceDir,
      skillsWorkspace: input.skillsWorkspace,
    } as const
    // Unlinked from the old runtime first, so the folder is not left holding
    // a config for a runtime this agent no longer uses.
    await writeAccess(db, {
      ...common,
      runtimeId: input.from,
      enabled: false,
    })
    const refused = await writeAccess(db, {
      ...common,
      runtimeId: input.to,
      enabled: true,
    })
    if (refused === null) continue

    db.update(agentTools)
      .set({ enabled: false, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(agentTools.agentId, input.agentId),
          eq(agentTools.kind, kind),
          eq(agentTools.refId, row.refId),
        ),
      )
      .run()
  }
}
