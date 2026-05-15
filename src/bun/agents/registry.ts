import { createAgentRegistry } from 'acpx/runtime'

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
 * Resolve a built-in agent id to the command-line a child process
 * should run. Throws if the id isn't in acpx's registry.
 *
 * Phase 2 will extend this to also resolve user-registered custom
 * agents from settings. The signature is forward-compatible: callers
 * pass `(agentId)` and get a command string back regardless of where
 * the mapping is sourced from.
 */
export function resolveAgentCommand(agentId: string): string {
  return builtinRegistry.resolve(agentId)
}

/**
 * List every agent id Herbie knows about. Today that's just the built-in
 * registry; Phase 2 adds custom agents on top.
 */
export function listAllAgentIds(): string[] {
  return [...builtinRegistry.list()]
}

// Returns null when the id is known; otherwise a human-readable
// reason suitable for a 400 response body. Centralised so every
// route that accepts an agentId from the wire applies the same
// allowlist check.
export function validateAgentId(agentId: string): string | null {
  if (listAllAgentIds().includes(agentId)) return null
  return `Unknown agent id: ${agentId}`
}
