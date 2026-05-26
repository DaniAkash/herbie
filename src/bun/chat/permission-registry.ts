import type { AcpPermissionDecision } from 'acpx-ai-provider'

// In-flight permission requests, keyed by conversation → requestId.
// The onPermissionRequest callback registers a resolver here when it
// needs to escalate to the user, then awaits the promise. The HTTP
// endpoint (POST /chat/:id/permission/:requestId) calls resolve() to
// hand the decision back to acpx. turn.cancel calls cancelAll() to
// abort any still-pending requests with { outcome: 'cancel' }.
//
// Module-level singleton — fine because the bun process owns the
// permission lifecycle, and concurrent conversations get their own
// nested map.

type Pending = {
  resolve: (decision: AcpPermissionDecision) => void
}

const pending = new Map<string, Map<string, Pending>>()

export function register(
  conversationId: string,
  requestId: string,
  entry: Pending,
): void {
  let bucket = pending.get(conversationId)
  if (!bucket) {
    bucket = new Map()
    pending.set(conversationId, bucket)
  }
  bucket.set(requestId, entry)
}

// Returns true if a pending entry existed and was resolved; false if
// the requestId is unknown (the API endpoint maps that to 409 so a
// double-click on Approve doesn't silently re-submit).
export function resolve(
  conversationId: string,
  requestId: string,
  decision: AcpPermissionDecision,
): boolean {
  const bucket = pending.get(conversationId)
  const entry = bucket?.get(requestId)
  if (!entry || !bucket) return false
  bucket.delete(requestId)
  if (bucket.size === 0) pending.delete(conversationId)
  entry.resolve(decision)
  return true
}

// Drains every still-pending request for the conversation as cancel.
// Called from ChatSession.cancel before the provider is disposed so
// the awaiting callback resolves cleanly (acpx sends a cancel
// response to the agent rather than letting the request time out).
export function cancelAll(conversationId: string): string[] {
  const bucket = pending.get(conversationId)
  if (!bucket) return []
  const ids = Array.from(bucket.keys())
  for (const entry of bucket.values()) {
    entry.resolve({ outcome: 'cancel' })
  }
  pending.delete(conversationId)
  return ids
}

// Test/dev helper — count of in-flight requests, used by smoke checks
// to verify the registry doesn't leak entries after a turn ends.
export function pendingCount(conversationId?: string): number {
  if (conversationId !== undefined) {
    return pending.get(conversationId)?.size ?? 0
  }
  let total = 0
  for (const b of pending.values()) total += b.size
  return total
}
