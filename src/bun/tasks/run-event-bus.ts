import type { PersistedRunEvent } from './run-events'

// In-process pub/sub for task-run events. Parallel to chat/eventBus —
// kept separate so a wildcard subscriber on one stream can't pick up
// the other, and so the bus is correctly torn down per pipeline.

export type RunEventListener = (event: PersistedRunEvent) => void

export interface RunEventBus {
  subscribe(runId: string, fn: RunEventListener): () => void
  emit(runId: string, event: PersistedRunEvent): void
}

class RunEventBusImpl implements RunEventBus {
  private readonly subs = new Map<string, Set<RunEventListener>>()

  subscribe(runId: string, fn: RunEventListener): () => void {
    let set = this.subs.get(runId)
    if (!set) {
      set = new Set()
      this.subs.set(runId, set)
    }
    set.add(fn)
    return () => {
      const s = this.subs.get(runId)
      if (!s) return
      s.delete(fn)
      if (s.size === 0) this.subs.delete(runId)
    }
  }

  emit(runId: string, event: PersistedRunEvent): void {
    const set = this.subs.get(runId)
    if (!set) return
    // Snapshot listeners before iterating — handlers may unsubscribe
    // mid-emit and mutating the set during a for-loop would skip
    // siblings.
    for (const fn of [...set]) fn(event)
  }
}

let instance: RunEventBus | null = null

export function getRunEventBus(): RunEventBus {
  if (!instance) instance = new RunEventBusImpl()
  return instance
}
