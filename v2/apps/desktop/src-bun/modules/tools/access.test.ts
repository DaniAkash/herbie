import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAgent } from '@bun/modules/agents/agents'
import { openDb } from '@bun/modules/db/db'
import { agentTools, mcpServers } from '@bun/modules/db/schema/schema'
import { applyAccess, moveAccess } from '@bun/modules/tools/access'
import { and, eq } from 'drizzle-orm'

let dir: string
let db: ReturnType<typeof openDb>['db']
let agentId: string
let workspaceDir: string

/** The switch the route writes before it asks for the file to be written. */
function switchOn(refId: string) {
  db.insert(agentTools)
    .values({ agentId, kind: 'server', refId, enabled: true })
    .run()
}

function enabledOf(refId: string): boolean | undefined {
  return db
    .select()
    .from(agentTools)
    .where(and(eq(agentTools.agentId, agentId), eq(agentTools.refId, refId)))
    .get()?.enabled
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'herbie-access-'))
  db = openDb(join(dir, 'herbie.sqlite')).db

  const agent = createAgent(db, join(dir, 'agents'), {
    name: 'Reader',
    color: 'post',
    brief: 'You read my newsletters each morning.',
    acpAgent: 'claude',
    effort: 'medium',
  })
  agentId = agent.id
  workspaceDir = agent.workspaceDir

  db.insert(mcpServers)
    .values({
      id: 'files',
      name: 'files',
      kind: 'stdio',
      target: 'bunx',
      args: 'mcp-files --root "/My Files/notes" --read-only',
    })
    .run()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('writing a switch into the runtime config', () => {
  test('keeps a quoted argument whole', async () => {
    switchOn('files')
    await applyAccess(db, {
      agentId,
      kind: 'server',
      refId: 'files',
      enabled: true,
      skillsWorkspace: join(dir, 'skills'),
    })

    // claude-code reads a project config from `.mcp.json`.
    const written = JSON.parse(
      readFileSync(join(workspaceDir, '.mcp.json'), 'utf8'),
    )
    expect(written.mcpServers.files.args).toEqual([
      'mcp-files',
      '--root',
      '/My Files/notes',
      '--read-only',
    ])
  })
})

describe('changing the runtime an agent runs on', () => {
  test('takes the switches that are on out of the old config', async () => {
    switchOn('files')
    await applyAccess(db, {
      agentId,
      kind: 'server',
      refId: 'files',
      enabled: true,
      skillsWorkspace: join(dir, 'skills'),
    })
    const claude = join(workspaceDir, '.mcp.json')
    expect(readFileSync(claude, 'utf8')).toContain('files')

    await moveAccess(db, {
      agentId,
      from: 'claude',
      to: 'codex',
      skillsWorkspace: join(dir, 'skills'),
    })
    expect(readFileSync(claude, 'utf8')).not.toContain('files')
  })

  test('turns off a switch the new runtime has no config for', async () => {
    switchOn('files')
    await moveAccess(db, {
      agentId,
      from: 'claude',
      to: 'codex',
      skillsWorkspace: join(dir, 'skills'),
    })
    expect(enabledOf('files')).toBe(false)
  })

  test('leaves a switch on when the new runtime takes it', async () => {
    switchOn('files')
    // copilot-cli is the other runtime with a project config this build can
    // write without the runtime having been installed and launched first.
    await moveAccess(db, {
      agentId,
      from: 'claude',
      to: 'copilot',
      skillsWorkspace: join(dir, 'skills'),
    })
    expect(enabledOf('files')).toBe(true)
  })
})
