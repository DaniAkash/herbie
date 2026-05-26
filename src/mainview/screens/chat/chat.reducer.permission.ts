import { patchPart, pushPart, type ReducerCtx } from './chat.reducer.parts'
import type {
  PermissionOutcome,
  PermissionPart,
  PermissionToolKind,
  PersistedEventDTO,
} from './chat.types'

// Push a permission part onto the active assistant message. Mirrors
// the tool-call append pattern — pending starts open, transitions to
// resolved when permission.resolved lands.
export function handlePermissionRequest(
  ctx: ReducerCtx,
  ev: PersistedEventDTO,
): void {
  const p = ev.payload as {
    requestId: string
    turnRequestId: string
    toolCallId: string
    toolName: string
    toolKind: PermissionToolKind | null
    input?: unknown
  }
  if (!p.requestId) return
  // Idempotent on replay: skip if a part with this id already exists.
  if (ctx.activeBlocks.has(p.requestId)) return
  pushPart(ctx, {
    kind: 'permission',
    id: p.requestId,
    turnRequestId: p.turnRequestId,
    toolCallId: p.toolCallId,
    toolName: p.toolName,
    toolKind: p.toolKind,
    input: p.input,
    state: 'pending',
  })
}

// Transitions a permission part to resolved. resolvedBy='auto' (mode
// short-circuit) and resolvedBy='cancel' (turn.cancel drained the
// registry) both land here too; the renderer distinguishes them by
// the resolvedBy field on the part.
export function handlePermissionResolved(
  ctx: ReducerCtx,
  ev: PersistedEventDTO,
): void {
  const p = ev.payload as {
    requestId: string
    outcome: PermissionOutcome
    resolvedBy: 'user' | 'auto' | 'cancel'
  }
  patchPart<PermissionPart>(ctx, p.requestId, 'permission', (part) => ({
    ...part,
    state: 'resolved',
    outcome: p.outcome,
    resolvedBy: p.resolvedBy,
    resolvedAt: ev.createdAt,
  }))
  ctx.activeBlocks.delete(p.requestId)
}
