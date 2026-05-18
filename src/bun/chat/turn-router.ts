import type { AcpxProvider } from 'acpx-ai-provider'
import type { ModelMessage } from 'ai'
import type { DB } from '../../db'
import type { Attachment } from '../../db/schema/attachments.sql'
import {
  applyConfigDelta,
  bootstrapNewProvider,
  buildProvider,
  type ProviderResolverDeps,
} from './provider-resolver'
import {
  type ChatTuple,
  providerKeyEqual,
  rebuildMessagesFromLog,
  tupleKey,
  tuplesEqual,
} from './tuple'
import { buildUserMessage } from './user-message'

/**
 * Mutable record holding the per-session state `routeTurn` reads and
 * writes. ChatSession owns one of these and passes it in by reference.
 * Keeping the routing logic out of the class lets ChatSession stay
 * focused on lifecycle (turn start/run/cancel/dispose) and keeps each
 * file under the line-count budget.
 */
export interface TurnRouteState {
  provider: AcpxProvider | null
  providerBootstrapped: boolean
  activeTuple: ChatTuple | null
}

export interface TurnRouteContext {
  db: DB
  conversationId: string
  /**
   * True when the conversation was seeded from outside (e.g. inbox
   * "Open in chat") — events exist but no acpx session has run yet.
   * Forces a per-conversation sessionKey so the seeded transcript
   * replay doesn't get stripped to a single user message under acpx's
   * continuation mode.
   */
  seededFromInbox: boolean
  resolverDeps: ProviderResolverDeps
  state: TurnRouteState
}

/**
 * Pick one of four paths per turn and return the `ModelMessage[]` to
 * feed `streamText`. Side effects mutate `ctx.state`:
 *
 *   A. Provider rebuild + transcript replay — fires when the provider
 *      key (agentId, workspacePath) differs from the active tuple, or
 *      when no provider exists yet (first send to a fresh session).
 *      Disposes the old provider, builds and bootstraps a new one,
 *      and returns `[...rebuiltTranscript, currentUser]`.
 *
 *   B. Bootstrap an unprepared provider — fires when a provider exists
 *      but its bootstrap (`prepare` + `setConfigOption`s) hasn't run
 *      yet. Single user message; acpx's `session/load` resumes the
 *      on-disk record. Practically unused today because the
 *      constructor doesn't pre-build a provider; reserved for a
 *      future change that does.
 *
 *   C. In-place config delta — fires when the provider key matches
 *      but model or effort differs. Pushes the changed setConfigOption
 *      RPCs onto the live provider. The agent's own session memory
 *      carries the prior turns; ship a single user message.
 *
 *   D. Pure continuation — same tuple as the last turn. Single user
 *      message; nothing to do.
 *
 * `excludeRequestId` (the just-emitted `turn.start`) is forwarded to
 * `rebuildMessagesFromLog` so the replay doesn't double-ship the
 * current user message.
 */
export async function routeTurn(
  ctx: TurnRouteContext,
  tuple: ChatTuple,
  text: string,
  excludeRequestId: string,
  attachments: Attachment[] = [],
): Promise<ModelMessage[]> {
  const { state } = ctx
  const sessionKeyOverride = ctx.seededFromInbox
    ? `seeded::${ctx.conversationId}::${tupleKey(tuple)}`
    : undefined

  const providerKept =
    state.provider !== null && providerKeyEqual(tuple, state.activeTuple)

  const userMessage = await buildUserMessage(text, attachments)

  if (!providerKept) {
    // Path A: provider rebuild + transcript replay.
    if (state.provider) {
      try {
        await state.provider.close('tuple handoff')
      } catch {
        // close() can race with an in-flight stream; non-fatal.
      }
    }
    state.provider = await buildProvider(
      ctx.resolverDeps,
      tuple,
      sessionKeyOverride,
    )
    state.providerBootstrapped = false
    await bootstrapNewProvider(ctx.db, state.provider, tuple)
    state.providerBootstrapped = true
    state.activeTuple = tuple

    const past = await rebuildMessagesFromLog(
      ctx.db,
      ctx.conversationId,
      excludeRequestId,
    )
    return [...past, userMessage]
  }

  // providerKept implies state.provider is non-null.
  const provider = state.provider as AcpxProvider

  if (!state.providerBootstrapped) {
    // Path B: bootstrap an unprepared provider, keep going on the
    // same wire (acpx session/load resumes the on-disk record).
    await bootstrapNewProvider(ctx.db, provider, tuple)
    state.providerBootstrapped = true
    state.activeTuple = tuple
    return [userMessage]
  }

  if (!tuplesEqual(tuple, state.activeTuple)) {
    // Path C: in-place config delta. Same agent + workspace, just push
    // the changed setConfigOption RPC(s) and continue.
    await applyConfigDelta(
      ctx.db,
      provider,
      state.activeTuple as ChatTuple,
      tuple,
    )
    state.activeTuple = tuple
    return [userMessage]
  }

  // Path D: same tuple as the last turn — pure continuation.
  return [userMessage]
}
