import type {
  AcpPermissionDecision,
  AcpPermissionRequest,
  AcpxProviderSettings,
} from 'acpx-ai-provider'
import { nanoid } from 'nanoid'
import type { PermissionMode } from '../routes/settings'
import type {
  PermissionOutcome,
  PermissionToolKind,
  ProtocolEvent,
} from './events.types'
import { cancelAll, register, resolve } from './permission-registry'

// Tool kinds where acpx's classifier returns a value that's safe to
// auto-approve under "auto-approve reads". Anything outside this set
// (edit, execute, delete, move, switch_mode, think, other, unknown)
// is treated as a write and escalates to the user under that mode.
const READ_KINDS: ReadonlySet<string> = new Set(['read', 'search', 'fetch'])

function isReadKind(kind: string | undefined | null): boolean {
  return kind != null && READ_KINDS.has(kind)
}

// Maps acpx's ToolKind values (`read` / `search` / `fetch` / `edit` /
// ...) to our renderer-visible PermissionToolKind union. Anything not
// in the union falls back to 'other' rather than null so the
// approval card can still pick an icon.
function normaliseKind(
  kind: AcpPermissionRequest['inferredKind'],
): PermissionToolKind | null {
  if (!kind) return null
  switch (kind) {
    case 'read':
    case 'search':
    case 'fetch':
    case 'edit':
    case 'execute':
    case 'delete':
    case 'move':
    case 'switch_mode':
    case 'think':
    case 'other':
      return kind
    default:
      // Future kinds added upstream — surface as 'other' rather than
      // null so the card still renders.
      return 'other'
  }
}

export interface BuildPermissionCallbackDeps {
  conversationId: string
  permissionMode: PermissionMode
  // Bridge to the EventSink; the callback uses this to emit
  // permission.request + permission.resolved events alongside the
  // turn's other events.
  emit: (event: ProtocolEvent) => Promise<void>
  // The currently-active turn's requestId. Carried on the
  // permission.request payload so the renderer can pair the card
  // with the turn it belongs to (multiple cards across multiple
  // turns is rare but possible during transcript replay).
  getActiveTurnRequestId: () => string | null
}

export function buildPermissionCallback(
  deps: BuildPermissionCallbackDeps,
): NonNullable<AcpxProviderSettings['onPermissionRequest']> {
  return async (req, { signal }) => {
    const kind = normaliseKind(req.inferredKind)
    const decision = decideAutomatically(deps.permissionMode, kind)
    if (decision !== undefined) {
      // Auto-resolved — emit a synthetic resolved event so the
      // renderer can show a compact breadcrumb without ever needing
      // a pending card. Skip the request event entirely; an
      // 'auto'-resolved entry without a prior 'pending' row is the
      // sentinel for "no card was ever shown".
      const requestId = nanoid(8)
      await emitResolved(deps, requestId, kind, req, decision, 'auto')
      return decision
    }

    // Escalate path — emit the pending event and wait for the user.
    const requestId = nanoid(8)
    await emitRequest(deps, requestId, kind, req)
    return await waitForUser(deps, requestId, kind, req, signal)
  }
}

// Returns a decision when the mode unambiguously decides, or
// undefined when the request needs to escalate to the user.
//
// Note: returning `undefined` from the outer callback would fall
// through to acpx's mode-based resolver, but we don't want that
// here — the picker is the source of truth, so we always either
// auto-resolve or escalate.
function decideAutomatically(
  mode: PermissionMode,
  kind: PermissionToolKind | null,
): AcpPermissionDecision | undefined {
  switch (mode) {
    case 'allow-all':
      return { outcome: 'allow_once' }
    case 'read-only':
      // Reads pass via reject? No — under read-only we ALLOW reads and
      // REJECT everything else. The naming is unfortunate but it
      // matches the picker label.
      return isReadKind(kind)
        ? { outcome: 'allow_once' }
        : { outcome: 'reject_once' }
    case 'auto-approve-reads':
      return isReadKind(kind) ? { outcome: 'allow_once' } : undefined
    case 'manual':
      return undefined
  }
}

async function emitRequest(
  deps: BuildPermissionCallbackDeps,
  requestId: string,
  kind: PermissionToolKind | null,
  req: AcpPermissionRequest,
): Promise<void> {
  const turnRequestId = deps.getActiveTurnRequestId() ?? requestId
  // The ACP raw shape has the tool call info on raw.toolCall; guard
  // every field access so a future schema change doesn't crash the
  // turn — we only need best-effort metadata for the card.
  const raw = (req.raw ?? {}) as {
    toolCall?: {
      toolCallId?: string
      title?: string
      name?: string
      rawInput?: unknown
    }
  }
  await deps.emit({
    type: 'permission.request',
    payload: {
      requestId,
      turnRequestId,
      toolCallId: raw.toolCall?.toolCallId ?? requestId,
      toolName: raw.toolCall?.title ?? raw.toolCall?.name ?? 'tool',
      toolKind: kind,
      input: raw.toolCall?.rawInput,
    },
  })
}

async function emitResolved(
  deps: BuildPermissionCallbackDeps,
  requestId: string,
  kind: PermissionToolKind | null,
  req: AcpPermissionRequest,
  decision: AcpPermissionDecision,
  resolvedBy: 'user' | 'auto' | 'cancel',
): Promise<void> {
  // For auto-resolved, emit a minimal "request" alongside so the
  // renderer has the tool name to show in the breadcrumb. Reuses
  // the same shape as the user-escalation path.
  if (resolvedBy === 'auto') {
    await emitRequest(deps, requestId, kind, req)
  }
  await deps.emit({
    type: 'permission.resolved',
    payload: {
      requestId,
      outcome: decision.outcome as PermissionOutcome,
      resolvedBy,
    },
  })
}

function waitForUser(
  deps: BuildPermissionCallbackDeps,
  requestId: string,
  kind: PermissionToolKind | null,
  req: AcpPermissionRequest,
  signal: AbortSignal,
): Promise<AcpPermissionDecision> {
  return new Promise((resolveOuter) => {
    let settled = false
    const finalize = async (
      decision: AcpPermissionDecision,
      resolvedBy: 'user' | 'cancel',
    ) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      await emitResolved(deps, requestId, kind, req, decision, resolvedBy)
      resolveOuter(decision)
    }
    const onAbort = () => {
      // turn.cancel landed while waiting. Mirror the cancelAll path
      // so the registry stays consistent even when the abort fires
      // before cancelAll has run.
      if (!settled) {
        void finalize({ outcome: 'cancel' }, 'cancel')
      }
    }
    if (signal.aborted) {
      void finalize({ outcome: 'cancel' }, 'cancel')
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    register(deps.conversationId, requestId, {
      resolve: (decision) => {
        // User-driven path: HTTP endpoint hands us the decision.
        void finalize(decision, 'user')
      },
    })
  })
}

// Re-export so call sites importing the callback also get the
// cancelAll helper from one place (ChatSession.cancel uses it).
export { cancelAll as cancelAllPendingPermissions, resolve as resolvePending }
