import { join } from 'node:path'
import { createLogger } from '@bun/lib/log'
import type { mcpServers } from '@bun/modules/db/schema/schema'
import { type AgentId, disconnect, link } from 'agent-mcp-manager'

const log = createLogger('tools')

/**
 * Herbie's runtime ids are acpx's; the config writer has its own.
 *
 * Only the overlap is listed. A runtime with no entry still gets its access
 * row, it just has no config file we know how to write, which is the honest
 * outcome rather than guessing at a format.
 */
const WRITABLE: Record<string, AgentId> = {
  claude: 'claude-code',
  codex: 'codex',
  cursor: 'cursor',
  opencode: 'opencode',
  kiro: 'kiro',
  windsurf: 'windsurf',
  trae: 'trae',
  antigravity: 'antigravity',
  copilot: 'copilot-cli',
}

export type McpServerRow = typeof mcpServers.$inferSelect

/** Where this agent's own mcp manifest lives, inside its own folder. */
function manifestDir(workspaceDir: string): string {
  return join(workspaceDir, '.herbie-mcp')
}

/**
 * Splits a stored argument line the way a shell would.
 *
 * A plain split on spaces turns `--root "/My Files/notes"` into three
 * arguments and hands the server a path that does not exist, so a quoted run
 * is kept whole.
 */
function splitArgs(line: string): string[] {
  const out: string[] = []
  for (const match of line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) {
    const token = match[1] ?? match[2] ?? match[3]
    if (token) out.push(token)
  }
  return out
}

function toSpec(row: McpServerRow) {
  if (row.kind === 'http' || row.kind === 'sse') {
    return { transport: row.kind, url: row.target } as const
  }
  return {
    transport: 'stdio',
    command: row.target,
    args: splitArgs(row.args),
  } as const
}

/**
 * Writes one server into, or out of, an agent's own config.
 *
 * Always at project scope, with the agent's own folder as the root. System
 * scope would write into the real `~/.claude.json` that the person's own
 * editor reads, and a switch inside Herbie must not reach outside Herbie.
 *
 * Returns what could not be done rather than throwing: the access row is the
 * record of what was asked for, and a config this build cannot write is a
 * thing to report, not a reason to refuse the setting.
 */
export async function setServerAccess(input: {
  runtimeId: string
  workspaceDir: string
  server: McpServerRow
  enabled: boolean
}): Promise<{ linked: boolean; reason?: string }> {
  const agent = WRITABLE[input.runtimeId]
  if (!agent) {
    return { linked: false, reason: `no config writer for ${input.runtimeId}` }
  }

  // Claude Code's project config takes stdio servers only. Writing an http
  // one would mean falling back to system scope, which is the one thing this
  // function will not do.
  const spec = toSpec(input.server)
  if (agent === 'claude-code' && spec.transport !== 'stdio') {
    return {
      linked: false,
      reason: 'Claude Code reads only stdio servers from a project config',
    }
  }

  const workspace = manifestDir(input.workspaceDir)
  try {
    if (input.enabled) {
      await link(workspace, {
        server: { name: input.server.name, spec },
        agent,
        scope: 'project',
        projectRoot: input.workspaceDir,
      })
    } else {
      await disconnect(workspace, {
        serverName: input.server.name,
        agent,
        scope: 'project',
        projectRoot: input.workspaceDir,
        removeIfLast: true,
      })
    }
    return { linked: true }
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'could not write'
    log.warn('server access not written', {
      server: input.server.name,
      agent,
      reason,
    })
    return { linked: false, reason }
  }
}
