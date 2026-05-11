import { createFileSessionStore } from 'acpx/runtime'
import type { AcpxProvider } from 'acpx-ai-provider'
import { ACPX_STATE_DIR, buildAcpxProvider } from '../chat/acpxProvider'
import { getDb } from '../db-singleton'
import {
  type AgentCapability,
  patchAgentCapabilities,
  readAgentCapability,
} from '../routes/settings'

// Agents with a documented reasoning_effort spectrum that the ACP server
// actually accepts via `session/set_config_option`. We previously included
// claude here based on the acpx-ai-provider README, but the live claude
// ACP server rejects the option with `Unknown config option:
// reasoning_effort`. Until openclaw/herbie#12 maps the real per-agent
// surface, only codex is opted in. Other agents fall back to runtime
// discovery — which gives us the key but no value list, so the picker
// just shows {low, medium, high}.
const REASONING_DEFAULTS: Record<string, AgentCapability['reasoning']> = {
  codex: {
    key: 'reasoning_effort',
    values: ['low', 'medium', 'high', 'xhigh'],
  },
}

const RECOGNIZED_REASONING_KEYS = new Set(['reasoning_effort', 'thought_level'])

const sessionStore = createFileSessionStore({ stateDir: ACPX_STATE_DIR })

export async function getOrDiscoverCapabilities(
  agentId: string,
  cwd: string,
): Promise<AgentCapability> {
  const cached = await readAgentCapability(getDb(), agentId)
  if (cached) return cached

  const fresh = await discoverCapabilities(agentId, cwd)
  await patchAgentCapabilities(getDb(), { [agentId]: fresh })
  return fresh
}

async function discoverCapabilities(
  agentId: string,
  cwd: string,
): Promise<AgentCapability> {
  // A short-lived persistent session is the cheapest way to harvest the
  // session record (which carries `available_models`) and the runtime's
  // capability set. Reusing it across probes via a fixed sessionKey means
  // we don't pay the agent-spawn cost twice.
  const probe = buildAcpxProvider({
    conversationId: `__capability-probe::${agentId}`,
    agentId,
    workspacePath: cwd,
    sessionKey: `__capability-probe::${agentId}`,
  })
  let provider: AcpxProvider | null = probe
  try {
    const handle = await probe.prepare()

    let models: string[] = []
    if (handle.acpxRecordId) {
      const record = await sessionStore.load(handle.acpxRecordId)
      models = record?.acpx?.available_models ?? []
    }

    let reasoning = REASONING_DEFAULTS[agentId]
    if (!reasoning) {
      const caps = await probe.runtime.getCapabilities?.({ handle })
      const key = caps?.configOptionKeys?.find((k) =>
        RECOGNIZED_REASONING_KEYS.has(k),
      )
      if (key) reasoning = { key, values: ['low', 'medium', 'high'] }
    }

    return {
      models,
      reasoning,
      discoveredAt: Date.now(),
    }
  } finally {
    try {
      await provider?.close('capability probe complete')
    } catch {
      // Probe close failures are harmless — the persistent record stays
      // on disk and gets picked up by the next normal session.
    }
    provider = null
  }
}

export type { AgentCapability }
