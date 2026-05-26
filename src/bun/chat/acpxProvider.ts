import { homedir } from 'node:os'
import path from 'node:path'
import {
  type AcpxMcpServerConfig,
  type AcpxProvider,
  createAcpxProvider,
} from 'acpx-ai-provider'
import { AGENT_REGISTRY_OVERRIDES } from '../agents/registry'
import { type PermissionMode, readSettings } from '../routes/settings'
import type { ProtocolEvent } from './events.types'
import { buildPermissionCallback } from './permission-callback'

export const ACPX_STATE_DIR = path.join(homedir(), '.herbie', 'acpx-state')

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
  // Permission policy for the per-call gate. Drives the
  // onPermissionRequest callback: 'allow-all' auto-approves, 'read-only'
  // auto-decides by tool kind, 'auto-approve-reads' escalates writes,
  // 'manual' escalates everything. See permission-callback.ts.
  permissionMode: PermissionMode
  // Bridge from the callback into the conversation's EventSink so
  // permission.request / permission.resolved events flow alongside
  // the rest of the turn's events. ChatSession passes its own
  // writeProtocolEvent here.
  writeProtocolEvent: (event: ProtocolEvent) => Promise<void>
  // Callback-time lookup for the active turn's requestId — paired
  // with the permission.request payload so the renderer can keep the
  // card grouped with its turn during transcript replay.
  getActiveTurnRequestId: () => string | null
}

export async function buildAcpxProvider(
  opts: BuildAcpxProviderOptions,
): Promise<AcpxProvider> {
  // Merge the built-in overrides (hermes today) with the user's custom
  // agents from settings. Customs win on id collision — same precedence
  // as detect.ts and registry.resolveAgentCommand, so probing, listing,
  // and chat startup all agree on what `agentId` resolves to.
  const settings = await readSettings()
  const overrides: Record<string, string> = { ...AGENT_REGISTRY_OVERRIDES }
  for (const c of settings.agents.customAgents) {
    overrides[c.id] = c.command
  }

  return createAcpxProvider({
    agent: opts.agentId,
    cwd: opts.workspacePath ?? homedir(),
    sessionKey: opts.sessionKey ?? opts.conversationId,
    sessionMode: 'persistent',
    stateDir: ACPX_STATE_DIR,
    resumeSessionId: opts.resumeSessionId ?? undefined,
    agentRegistryOverrides: overrides,
    // Mode-based fallback only kicks in if onPermissionRequest throws.
    // The picker is the real source of truth — see permission-callback.
    permissionMode: 'approve-reads',
    nonInteractivePermissions: 'deny',
    onPermissionRequest: buildPermissionCallback({
      conversationId: opts.conversationId,
      permissionMode: opts.permissionMode,
      emit: opts.writeProtocolEvent,
      getActiveTurnRequestId: opts.getActiveTurnRequestId,
    }),
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
