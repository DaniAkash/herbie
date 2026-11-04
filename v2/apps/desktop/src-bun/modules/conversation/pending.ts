/**
 * Work that is waiting on a person.
 *
 * Two things block mid-turn: an `ask` tool call waiting for answers, and a
 * permission request waiting for a decision. Both are a promise held open
 * inside the agent's turn and resolved by an HTTP route, so both live here
 * rather than in two registries that would drift.
 *
 * Lifted from v1's permission registry, which had the shape right: a nested
 * map, a resolve that reports whether it found anything so a double click
 * becomes a 409 rather than a silent second answer, and a drain on cancel so
 * the awaiting side resolves cleanly instead of timing out.
 */

interface Waiting<T> {
  readonly resolve: (value: T) => void
  /** What to resolve with when the turn is cancelled underneath it. */
  readonly onCancel: () => T
}

const waiting = new Map<string, Map<string, Waiting<unknown>>>()

export function hold<T>(agentId: string, key: string, entry: Waiting<T>): void {
  let bucket = waiting.get(agentId)
  if (!bucket) {
    bucket = new Map()
    waiting.set(agentId, bucket)
  }
  bucket.set(key, entry as Waiting<unknown>)
}

export function release(agentId: string, key: string): void {
  const bucket = waiting.get(agentId)
  bucket?.delete(key)
  if (bucket?.size === 0) waiting.delete(agentId)
}

/**
 * Settles one waiting thing.
 *
 * Returns false when the key is unknown, which is how the routes tell a
 * second submission of the same answer from a first one and answer 409. An
 * answer that quietly resolved nothing is worse than a rejected one: the
 * person believes they replied and the agent is still waiting.
 */
export function settle<T>(agentId: string, key: string, value: T): boolean {
  const bucket = waiting.get(agentId)
  const entry = bucket?.get(key)
  if (!entry || !bucket) return false
  release(agentId, key)
  entry.resolve(value)
  return true
}

export function isPending(agentId: string, key: string): boolean {
  return waiting.get(agentId)?.has(key) ?? false
}

/**
 * Drains everything this agent is waiting on, as a cancellation.
 *
 * Called before a turn is torn down, so the `ask` that was blocking resolves
 * and the permission request gets an answer acpx can pass back to the agent,
 * rather than both being left for a timeout to notice.
 */
export function cancelAll(agentId: string): string[] {
  const bucket = waiting.get(agentId)
  if (!bucket) return []
  const keys = [...bucket.keys()]
  for (const entry of bucket.values()) entry.resolve(entry.onCancel())
  waiting.delete(agentId)
  return keys
}

export function pendingCount(agentId?: string): number {
  if (agentId !== undefined) return waiting.get(agentId)?.size ?? 0
  let total = 0
  for (const bucket of waiting.values()) total += bucket.size
  return total
}
