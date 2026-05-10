import { homedir } from 'node:os'
import path from 'node:path'
import { type AcpxProvider, createAcpxProvider } from 'acpx-ai-provider'

const STATE_DIR = path.join(homedir(), '.herbie', 'acpx-state')

// Mirror the override in src/bun/agents/detect.ts so a session can spin up
// hermes — acpx 0.6.x doesn't ship hermes in built-ins yet.
const REGISTRY_OVERRIDES: Record<string, string> = { hermes: 'hermes acp' }

export interface BuildAcpxProviderOptions {
  conversationId: string
  agentId: string
  cwd?: string | null
  resumeSessionId?: string | null
}

export function buildAcpxProvider(
  opts: BuildAcpxProviderOptions,
): AcpxProvider {
  return createAcpxProvider({
    agent: opts.agentId,
    cwd: opts.cwd ?? homedir(),
    sessionKey: opts.conversationId,
    sessionMode: 'persistent',
    stateDir: STATE_DIR,
    resumeSessionId: opts.resumeSessionId ?? undefined,
    agentRegistryOverrides: REGISTRY_OVERRIDES,
  })
}
