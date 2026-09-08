import { splitArgv } from 'acp-probe'
import { createAgentRegistry } from 'acpx/runtime'
import { readSettings } from '../routes/settings'

// Shared with detect.ts and acpxProvider.ts so detection, validation,
// probing, and chat startup all agree on which agent ids are valid.
// hermes still needs the local override; once acpx ships it upstream
// the entry can be dropped from this single map.
export const AGENT_REGISTRY_OVERRIDES: Record<string, string> = {
  hermes: 'hermes acp',
}

const builtinRegistry = createAgentRegistry({
  overrides: AGENT_REGISTRY_OVERRIDES,
})

/**
 * Resolve an agent id (built-in or custom) to the argv a child process
 * should run. Customs shadow built-ins on id collision, matching
 * detect.ts and acpxProvider's merge order.
 */
export async function resolveAgentArgv(agentId: string): Promise<string[]> {
  const customs = await readCustomAgents()
  const custom = customs.find((c) => c.id === agentId)
  if (custom) return splitArgv(custom.command)
  return toArgv(builtinRegistry.resolve(agentId))
}

/**
 * Normalise a registry entry to argv. The registry hands back a
 * pre-split array for agents whose launch needs exact argument
 * boundaries and a plain string otherwise; re-splitting the array form
 * would undo boundaries the registry deliberately set.
 */
export function toArgv(resolved: string | string[]): string[] {
  return Array.isArray(resolved) ? [...resolved] : splitArgv(resolved)
}

/**
 * List every agent id Herbie knows about — built-ins plus the user's
 * custom agents. Used by validateAgentId and the renderer's "is this
 * id still resolvable" guard.
 */
export async function listAllAgentIds(): Promise<string[]> {
  const customs = await readCustomAgents()
  const customIds = customs.map((c) => c.id)
  const builtinIds = builtinRegistry.list()
  // Customs first so collision dedupe favours the shadowing entry.
  return [...customIds, ...builtinIds.filter((id) => !customIds.includes(id))]
}

// Returns null when the id is known; otherwise a human-readable
// reason suitable for a 400 response body. Centralised so every
// route that accepts an agentId from the wire applies the same
// allowlist check.
export async function validateAgentId(agentId: string): Promise<string | null> {
  const ids = await listAllAgentIds()
  if (ids.includes(agentId)) return null
  return `Unknown agent id: ${agentId}`
}

async function readCustomAgents() {
  const settings = await readSettings()
  return settings.agents.customAgents
}
