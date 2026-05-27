// Lightweight pub/sub for task-run finalize events. The run event bus
// is per-runId so a wildcard would mean subscribing once per run as
// runs are created. This module gives the notification dispatcher a
// single subscription point for "any task just finished" without
// touching the per-run bus shape.

export type TaskFinalizedStatus = 'completed' | 'cancelled' | 'error'

export interface TaskFinalizedEvent {
  runId: string
  status: TaskFinalizedStatus
}

type Listener = (event: TaskFinalizedEvent) => void
const listeners = new Set<Listener>()

export function emitTaskFinalized(event: TaskFinalizedEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {}
  }
}

export function onTaskFinalized(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
