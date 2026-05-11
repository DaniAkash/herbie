import { homedir } from 'node:os'
import path from 'node:path'
import {
  type AcpxMcpServerConfig,
  type AcpxProvider,
  createAcpxProvider,
} from 'acpx-ai-provider'

export const ACPX_STATE_DIR = path.join(homedir(), '.herbie', 'acpx-state')

// Mirror the override in src/bun/agents/detect.ts so a session can spin up
// hermes — acpx 0.6.x doesn't ship hermes in built-ins yet.
const REGISTRY_OVERRIDES: Record<string, string> = { hermes: 'hermes acp' }

// What we store in settings — arrays of {name, value} match ACP's wire
// format. The provider's public API uses Record<string, string> for env /
// headers and translates internally; we convert at the boundary below.
export interface McpServerStdio {
  type: 'stdio'
  name: string
  command: string
  args: string[]
  env: Array<{ name: string; value: string }>
}

export interface McpServerHttp {
  type: 'http' | 'sse'
  name: string
  url: string
  headers: Array<{ name: string; value: string }>
}

export type McpServerSpec = McpServerStdio | McpServerHttp

export interface BuildAcpxProviderOptions {
  conversationId: string
  agentId: string
  // Optional explicit overrides; default to single-provider-per-conversation
  // behaviour (sessionKey = conversationId, cwd = $HOME).
  workspacePath?: string
  sessionKey?: string
  resumeSessionId?: string | null
  mcpServers?: McpServerSpec[]
}

export function buildAcpxProvider(
  opts: BuildAcpxProviderOptions,
): AcpxProvider {
  return createAcpxProvider({
    agent: opts.agentId,
    cwd: opts.workspacePath ?? homedir(),
    sessionKey: opts.sessionKey ?? opts.conversationId,
    sessionMode: 'persistent',
    stateDir: ACPX_STATE_DIR,
    resumeSessionId: opts.resumeSessionId ?? undefined,
    agentRegistryOverrides: REGISTRY_OVERRIDES,
    // TODO(permissions): blanket-approve every tool call until the in-app
    // permission UX is wired. Revisit before any non-personal use.
    permissionMode: 'approve-all',
    nonInteractivePermissions: 'deny',
    mcpServers: opts.mcpServers?.map(toProviderShape),
  })
}

function toProviderShape(server: McpServerSpec): AcpxMcpServerConfig {
  if (server.type === 'stdio') {
    return {
      type: 'stdio',
      name: server.name,
      command: server.command,
      args: server.args,
      env: pairsToRecord(server.env),
    }
  }
  return {
    type: server.type,
    name: server.name,
    url: server.url,
    headers: pairsToRecord(server.headers),
  }
}

function pairsToRecord(
  pairs: Array<{ name: string; value: string }>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { name, value } of pairs) out[name] = value
  return out
}
