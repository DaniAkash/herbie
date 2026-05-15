import { createAgentRegistry } from 'acpx/runtime'

// acpx's built-in registry + a small static override for agents that
// acpx 0.6.x doesn't ship. hermes still needs the local override; once
// upstream picks it up we can drop this.
const STATIC_OVERRIDES: Record<string, string> = { hermes: 'hermes acp' }

const builtinRegistry = createAgentRegistry({ overrides: STATIC_OVERRIDES })

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
