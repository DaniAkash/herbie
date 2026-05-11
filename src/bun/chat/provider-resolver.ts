import { access as fsAccess } from 'node:fs/promises'
import type { AcpxProvider } from 'acpx-ai-provider'
import type { DB } from '../../db'
import {
  readAgentCapability,
  readSettings,
  removeRecentWorkspace,
} from '../routes/settings'
import { buildAcpxProvider } from './acpxProvider'
import type { ProtocolEvent } from './events.types'
import { type ChatTuple, tupleKey } from './tuple'

export interface ProviderResolverDeps {
  db: DB
  conversationId: string
  providers: Map<string, AcpxProvider>
  writeProtocolEvent: (event: ProtocolEvent) => Promise<void>
}

export async function getOrCreateProvider(
  deps: ProviderResolverDeps,
  tuple: ChatTuple,
): Promise<AcpxProvider> {
  const key = tupleKey(tuple)
  const cached = deps.providers.get(key)
  if (cached) return cached

  const cwd = await resolveWorkspaceCwd(deps, tuple.workspacePath)
  const provider = buildAcpxProvider({
    conversationId: deps.conversationId,
    agentId: tuple.agentId,
    workspacePath: cwd,
    sessionKey: key,
  })

  // Spawn the ACP server + open the session before applying config —
  // setConfigOption is an in-session IPC call. Effort changes apply to
  // the *next* turn, which is exactly what we're about to issue. A
  // failure here (unknown agent, auth, config key the runtime doesn't
  // accept) propagates to appendUserMessage, which writes turn.error
  // and unsticks the conversation.
  await provider.prepare()
  if (tuple.modelId) {
    await provider.setConfigOption('model', tuple.modelId)
  }
  if (tuple.reasoningEffort) {
    // Only apply reasoning when we know the agent advertises a key for
    // it. No fallback to 'reasoning_effort' — earlier builds did that
    // and tripped on agents that document but don't actually accept
    // the option (e.g. claude). The picker hides when the cap is
    // missing, so reaching this branch with a missing cap means a
    // stale conversation row; skip silently.
    const cap = await readAgentCapability(deps.db, tuple.agentId)
    const reasoningKey = cap?.reasoning?.key
    if (reasoningKey) {
      await provider.setConfigOption(reasoningKey, tuple.reasoningEffort)
    }
  }

  deps.providers.set(key, provider)
  return provider
}

// Resolves the requested workspace path to an existing directory. If the
// user-pinned path was deleted out from under us, emit a meta event,
// prune from the MRU, and return the default workspace.
async function resolveWorkspaceCwd(
  deps: ProviderResolverDeps,
  requested: string | null,
): Promise<string> {
  const settings = await readSettings()
  const fallback = settings.composer.workspaces.default
  const target = requested ?? fallback
  try {
    await fsAccess(target)
    return target
  } catch {
    if (target !== fallback) {
      await deps.writeProtocolEvent({
        type: 'meta.workspace-missing',
        payload: { previousPath: target, fallbackPath: fallback },
      })
      await removeRecentWorkspace(deps.db, target).catch(() => {
        // Pruning is a UX nicety; failing to update the MRU shouldn't
        // block the user's send.
      })
    }
    return fallback
  }
}
