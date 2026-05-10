import { homedir } from 'node:os'
import path from 'node:path'
import { type AcpxProvider, createAcpxProvider } from 'acpx-ai-provider'

export const ACPX_STATE_DIR = path.join(homedir(), '.herbie', 'acpx-state')

// Mirror the override in src/bun/agents/detect.ts so a session can spin up
// hermes — acpx 0.6.x doesn't ship hermes in built-ins yet.
const REGISTRY_OVERRIDES: Record<string, string> = { hermes: 'hermes acp' }

export interface BuildAcpxProviderOptions {
  conversationId: string
  agentId: string
  // Optional explicit overrides; default to single-provider-per-conversation
  // behaviour (sessionKey = conversationId, cwd = $HOME).
  workspacePath?: string
  sessionKey?: string
  resumeSessionId?: string | null
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
  })
}
