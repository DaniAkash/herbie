import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from '@bun/modules/db/db'
import { agents } from '@bun/modules/db/schema/schema'
import { eq } from 'drizzle-orm'

/**
 * A readable id, from the name, unique within the table.
 *
 * It is also the folder name, which is why it is a slug rather than a uuid:
 * someone looking in ~/.herbie/agents wants to see which agent is which.
 */
function slugFor(db: Db, name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'agent'

  const taken = new Set(
    db
      .select({ id: agents.id })
      .from(agents)
      .all()
      .map((row) => row.id),
  )
  if (!taken.has(base)) return base
  for (let n = 2; ; n += 1) {
    const next = `${base}-${n}`
    if (!taken.has(next)) return next
  }
}

/**
 * The folder a name would be given, without creating anything.
 *
 * The window shows this before the agent exists, and it asks rather than
 * working it out: the slug and its collision suffix are decided against the
 * table, so a path guessed in the webview would offer the second `reader` the
 * first one's folder.
 */
export function plannedWorkspace(
  db: Db,
  agentsRoot: string,
  name: string,
): string {
  return join(agentsRoot, slugFor(db, name))
}

export interface AgentDraft {
  readonly name: string
  readonly color: string
  readonly brief: string
  readonly acpAgent: string
  readonly model?: string | null
  readonly effort: string
  readonly workspaceDir?: string | null
}

/**
 * Creates an agent and the folder it works in.
 *
 * The row goes first, because the id it allocates is also the folder name and
 * two creates racing for one name have to be settled by the table. A folder
 * that cannot be made takes the row back out again: an agent whose workspace
 * is missing cannot hold a conversation, and leaving the row behind would also
 * mean the next create of the same name quietly becoming `reader-2`.
 */
export function createAgent(db: Db, agentsRoot: string, draft: AgentDraft) {
  const id = slugFor(db, draft.name)
  const row = db
    .insert(agents)
    .values({
      id,
      name: draft.name,
      color: draft.color,
      brief: draft.brief,
      acpAgent: draft.acpAgent,
      model: draft.model ?? null,
      effort: draft.effort,
      workspaceDir: draft.workspaceDir || join(agentsRoot, id),
    })
    .returning()
    .get()

  try {
    mkdirSync(row.workspaceDir, { recursive: true })
  } catch (cause) {
    db.delete(agents).where(eq(agents.id, id)).run()
    throw cause
  }
  return row
}

/**
 * Removes an agent, its rows and its folder.
 *
 * The folder goes only when it is one we made. A workspace someone pointed at
 * their own repository is theirs, and deleting an agent is not permission to
 * delete that.
 */
export function deleteAgent(db: Db, agentsRoot: string, id: string): boolean {
  const row = db.select().from(agents).where(eq(agents.id, id)).get()
  if (!row) return false

  db.delete(agents).where(eq(agents.id, id)).run()
  if (row.workspaceDir === join(agentsRoot, id)) {
    rmSync(row.workspaceDir, { recursive: true, force: true })
  }
  return true
}
