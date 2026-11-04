import type { TranscriptRecord } from '@bun/shared/transcript'

/**
 * Records, as they are written, to whoever is watching an agent.
 *
 * One bus per process rather than per agent, keyed inside. The subscriber is
 * the SSE route, which is why the shape is a callback rather than a queue:
 * a connection that has gone away should cost nothing to deliver to, and
 * unsubscribing on abort is the whole of the cleanup.
 */

type Listener = (record: TranscriptRecord) => void

const listeners = new Map<string, Set<Listener>>()

export function subscribe(agentId: string, listener: Listener): () => void {
  let bucket = listeners.get(agentId)
  if (!bucket) {
    bucket = new Set()
    listeners.set(agentId, bucket)
  }
  bucket.add(listener)
  return () => {
    bucket?.delete(listener)
    if (bucket?.size === 0) listeners.delete(agentId)
  }
}

/**
 * Hands a record to every watcher.
 *
 * A listener that throws is not allowed to stop the next one, or to fail the
 * append that published it. The write already happened; a broken subscriber
 * is the subscriber's problem.
 */
export function publish(agentId: string, record: TranscriptRecord): void {
  const bucket = listeners.get(agentId)
  if (!bucket) return
  for (const listener of bucket) {
    try {
      listener(record)
    } catch {
      // A dead connection mid-write. The abort handler removes it.
    }
  }
}

export function watcherCount(agentId: string): number {
  return listeners.get(agentId)?.size ?? 0
}
