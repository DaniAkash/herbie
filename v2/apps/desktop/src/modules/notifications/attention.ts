import type { Notification } from '@/modules/api/notifications.hooks'

/**
 * What the rail should wear for an agent, read off the inbox.
 *
 * The thread header already draws `input-needed`, but it reads the pending
 * list of the conversation on screen, so a blocked agent nobody is looking at
 * renders as plain idle in the rail. The notification row is the one place
 * that knows, which is why the rail derives from it rather than from the
 * agent's own state column.
 */

export type AttentionFace = 'input-needed' | 'error'

const FACE: Record<string, AttentionFace> = {
  needs_you: 'input-needed',
  turn_failed: 'error',
  agent_parked: 'error',
}

/** Neither seen nor dismissed, which is the row still asking for something. */
function live(notification: Notification): boolean {
  return notification.seenAt === null && notification.dismissedAt === null
}

/** The list arrives newest first, so the first live row is the current one. */
export function attentionFor(
  notifications: readonly Notification[],
  agentId: string,
): AttentionFace | null {
  const newest = notifications.find((n) => n.agentId === agentId && live(n))
  return newest ? (FACE[newest.kind] ?? null) : null
}

/** The expression a row wears in the inbox, where every row has a kind. */
export function faceForKind(kind: string): AttentionFace | 'idle' {
  return FACE[kind] ?? 'idle'
}
