import { type AgentProbeResult, probeAgent } from 'acp-probe'
import { getDb } from '../db-singleton'
import {
  type AgentCapability,
  patchAgentCapabilities,
  readAgentCapability,
} from '../routes/settings'
import { CAPABILITY_SCHEMA_VERSION } from '../routes/settings.agent-capability.schema'
import { resolveAgentCommand } from './registry'

// Cached capabilities are considered stale when older than this window
// OR when their stored shape predates a field we now need. The schema
// version is implicit — capabilityIsFresh() looks for fields added by
// the acp-probe migration and re-probes if any are missing.
const FRESHNESS_MS = 24 * 60 * 60 * 1000

export async function getOrDiscoverCapabilities(
  agentId: string,
  cwd: string,
): Promise<AgentCapability> {
  const cached = await readAgentCapability(getDb(), agentId)
  if (cached && capabilityIsFresh(cached)) return cached

  const fresh = await discoverCapabilities(agentId, cwd)
  await patchAgentCapabilities(getDb(), { [agentId]: fresh })
  return fresh
}

async function discoverCapabilities(
  agentId: string,
  cwd: string,
): Promise<AgentCapability> {
  // Resolve to the actual command first so a built-in agent and a
  // custom one (Phase 2) go through the same `probeAgent({ command })`
  // entry point. Keeps the probe side ignorant of where the mapping
  // lives.
  const command = await resolveAgentCommand(agentId)
  const result = await probeAgent({
    command,
    cwd,
    // Surface authMethods but don't gate the probe — gemini and
    // others advertise auth methods but `session/new` works without
    // them. If the agent actually needs creds, the probe returns
    // `error.code = 'auth_required'` and we throw below.
    authPolicy: 'skip',
    timeoutMs: 30_000,
  })

  if (result.error) {
    throw new Error(
      `acp-probe failed for ${agentId}: ${result.error.code} — ${result.error.message}`,
    )
  }

  return resultToCapability(result)
}

function resultToCapability(r: AgentProbeResult): AgentCapability {
  // Source the picker's model list from `modelConfig.values` — the ids
  // `setConfigOption('model', X)` will actually accept. The parallel
  // `models[]` array is a *declarative* surface (`availableModels`); on
  // some adapters (codex) it lists model+effort combinations that
  // `setConfigOption` rejects, which silently breaks the next prompt.
  // Reuse the rich name/description from `models[]` where the id
  // overlaps so the picker still shows nice labels.
  const richModels = new Map(r.models.map((m) => [m.id, m]))
  const modelIds = r.modelConfig?.values ?? r.models.map((m) => m.id)
  const models = modelIds.map((id) => {
    const rich = richModels.get(id)
    return {
      id,
      name: rich?.name ?? null,
      description: rich?.description ?? null,
    }
  })
  return {
    models,
    reasoning: r.reasoning
      ? {
          key: r.reasoning.configId,
          values: r.reasoning.values,
          defaultValue: r.reasoning.defaultValue ?? null,
        }
      : null,
    promptCapabilities: {
      image: r.capabilities.promptCapabilities.image,
      audio: r.capabilities.promptCapabilities.audio,
      embeddedContext: r.capabilities.promptCapabilities.embeddedContext,
    },
    agentName: r.agentInfo?.name ?? null,
    discoveredAt: Date.now(),
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
  }
}

// Re-probe rows that predate the current cache shape (missing
// `promptCapabilities` from the earlier migration, or below the
// current `schemaVersion`) or that have aged past the freshness
// window. Capabilities don't change without an agent upgrade; a day
// is plenty for cache.
function capabilityIsFresh(c: AgentCapability): boolean {
  if (c.promptCapabilities === undefined) return false
  if (c.schemaVersion !== CAPABILITY_SCHEMA_VERSION) return false
  return Date.now() - c.discoveredAt < FRESHNESS_MS
}

export type { AgentCapability }
