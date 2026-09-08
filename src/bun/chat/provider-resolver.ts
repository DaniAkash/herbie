import { stat } from 'node:fs/promises'
import type { AcpxProvider } from 'acpx-ai-provider'
import type { DB } from '../../db'
import {
  type PermissionMode,
  readAgentCapability,
  readSettings,
  removeRecentWorkspace,
} from '../routes/settings'
import { modelConfigKey } from '../routes/settings.agent-capability.schema'
import { buildAcpxProvider } from './acpxProvider'
import type { ProtocolEvent } from './events.types'
import { type ChatTuple, tupleKey } from './tuple'

export interface ProviderResolverDeps {
  db: DB
  conversationId: string
  writeProtocolEvent: (event: ProtocolEvent) => Promise<void>
  // Permission policy for this conversation (resolved upstream by
  // ChatSession from conv.permission_mode ?? settings default).
  // Plumbed through buildAcpxProvider into the onPermissionRequest
  // callback.
  permissionMode: PermissionMode
  // Closure into ChatSession's activeTurn — the callback uses this
  // to stamp the active turn's requestId onto permission.request
  // payloads so the renderer can group cards by turn during replay.
  getActiveTurnRequestId: () => string | null
}

/**
 * Build a fresh AcpxProvider for a tuple. Does NOT cache; the caller
 * owns provider lifetime. Does NOT bootstrap (call
 * `bootstrapNewProvider` separately before the first turn).
 *
 * Session records are scoped per conversation + tuple so no two
 * conversations share an on-disk acpx record. The tupleKey suffix
 * isolates records when the agent or workspace changes mid-conversation
 * (those rebuild the provider via Path A). Model and reasoning-effort
 * changes go through Path C (in-place setConfigOption) and do not
 * rebuild the provider, so they share the record for that conversation.
 */
export async function buildProvider(
  deps: ProviderResolverDeps,
  tuple: ChatTuple,
): Promise<AcpxProvider> {
  const settings = await readSettings()
  const cwd = await resolveWorkspaceCwd(deps, tuple.workspacePath, settings)
  const mcpServers = settings.mcp.servers.map(({ id: _id, ...rest }) => rest)
  return await buildAcpxProvider({
    conversationId: deps.conversationId,
    agentId: tuple.agentId,
    workspacePath: cwd,
    sessionKey: `conv::${deps.conversationId}::${tupleKey(tuple)}`,
    mcpServers,
    permissionMode: deps.permissionMode,
    writeProtocolEvent: deps.writeProtocolEvent,
    getActiveTurnRequestId: deps.getActiveTurnRequestId,
  })
}

/**
 * Run the post-build setup steps that need a live ACP session:
 * `prepare()` (spawn child + open session), then `setConfigOption`
 * for model and the agent's reasoning key. Each config call is
 * wrapped in try/catch with a non-fatal warn — a missing or
 * unsupported key shouldn't kill the first turn; the agent runs on
 * its default.
 *
 * Called once per provider lifetime: after `buildProvider` produces
 * a fresh provider and before the first `streamText` against it.
 */
export async function bootstrapNewProvider(
  db: DB,
  provider: AcpxProvider,
  tuple: ChatTuple,
): Promise<void> {
  // prepare() spawns the ACP child + opens the session. Has to land
  // before setConfigOption (which is an in-session IPC call).
  // Failures here propagate to the caller; they're fatal — no agent
  // means no turn.
  await provider.prepare()

  const cap =
    tuple.modelId || tuple.reasoningEffort
      ? await readAgentCapability(db, tuple.agentId)
      : null

  if (tuple.modelId) {
    const modelKey = modelConfigKey(cap)
    try {
      // TODO(acpx#30): silently no-ops on gemini-cli. The adapter doesn't
      // implement `session/set_config_option`, so the call throws and the
      // catch below absorbs it — the picker reflects the chosen model but
      // gemini stays on its default. Switch to `provider.setModel(...)`
      // once acpx-ai-provider exposes the dedicated `session/set_model`
      // path. https://github.com/DaniAkash/acpx/issues/30
      await provider.setConfigOption(modelKey, tuple.modelId)
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: non-fatal — agent stays on its default model
      console.warn(
        `[provider-resolver] setConfigOption(${modelKey}) failed:`,
        err,
      )
    }
  }

  if (tuple.reasoningEffort) {
    // Only apply reasoning when the agent advertises a key for it.
    // The picker hides the control when the cap is missing, so a
    // reasoning value paired with a missing cap means a stale
    // conversation row — skip silently.
    const reasoningKey = cap?.reasoning?.key
    if (reasoningKey) {
      try {
        await provider.setConfigOption(reasoningKey, tuple.reasoningEffort)
      } catch (err) {
        // biome-ignore lint/suspicious/noConsole: non-fatal — agent stays on its default effort
        console.warn(
          `[provider-resolver] setConfigOption(${reasoningKey}) failed:`,
          err,
        )
      }
    }
  }
}

/**
 * Push only the changed config fields onto a live provider. Caller
 * has already verified `providerKeyEqual(oldTuple, newTuple)` is
 * true, so this is safe — same agent process, same workspace, same
 * in-flight session memory.
 *
 * Model and reasoning effort are the only config-deltable fields.
 */
export async function applyConfigDelta(
  db: DB,
  provider: AcpxProvider,
  oldTuple: ChatTuple,
  newTuple: ChatTuple,
): Promise<void> {
  // Same-agent guarantee from providerKeyEqual: one capability lookup
  // serves both deltas.
  const cap = await readAgentCapability(db, newTuple.agentId)

  if (newTuple.modelId && newTuple.modelId !== oldTuple.modelId) {
    try {
      await provider.setConfigOption(modelConfigKey(cap), newTuple.modelId)
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: non-fatal — see bootstrapNewProvider
      console.warn('[provider-resolver] in-place model change failed:', err)
    }
  }
  if (
    newTuple.reasoningEffort &&
    newTuple.reasoningEffort !== oldTuple.reasoningEffort
  ) {
    const reasoningKey = cap?.reasoning?.key
    if (reasoningKey) {
      try {
        await provider.setConfigOption(reasoningKey, newTuple.reasoningEffort)
      } catch (err) {
        // biome-ignore lint/suspicious/noConsole: non-fatal — see bootstrapNewProvider
        console.warn(
          `[provider-resolver] in-place ${reasoningKey} change failed:`,
          err,
        )
      }
    }
  }
}

// Resolves the requested workspace path to an existing directory. If the
// user-pinned path was deleted out from under us — or was somehow set to
// a file (corrupted row, future MCP-driven update) — emit a meta event,
// prune from the MRU, and return the default workspace. stat() follows
// symlinks, so a symlink-to-directory works; broken symlinks and
// regular files both fall through to the fallback.
async function resolveWorkspaceCwd(
  deps: ProviderResolverDeps,
  requested: string | null,
  settings: Awaited<ReturnType<typeof readSettings>>,
): Promise<string> {
  const fallback = settings.composer.workspaces.default
  const target = requested ?? fallback
  if (await isDirectory(target)) return target

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

async function isDirectory(p: string): Promise<boolean> {
  try {
    const s = await stat(p)
    return s.isDirectory()
  } catch {
    return false
  }
}
