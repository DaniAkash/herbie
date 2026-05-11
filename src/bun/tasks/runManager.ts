import { getDb } from '../db-singleton'
import type { TaskRunInit } from './TaskRunSession'
import { TaskRunSession } from './TaskRunSession'

// In-memory registry of in-flight task runs. Mirrors chat's
// sessionManager — lets routes look up an active run by id to
// cancel mid-stream or replay buffered events to a late SSE
// subscriber. Disposed runs drop out of the map.

export interface RunManager {
  start(init: TaskRunInit): Promise<TaskRunSession>
  get(runId: string): TaskRunSession | undefined
  forget(runId: string): void
  cancel(runId: string, reason?: string): Promise<void>
  disposeAll(): Promise<void>
}

class RunManagerImpl implements RunManager {
  private readonly runs = new Map<string, TaskRunSession>()

  async start(init: TaskRunInit): Promise<TaskRunSession> {
    const session = await TaskRunSession.create(getDb(), init)
    this.runs.set(session.id, session)
    void session.start().catch(() => {
      // The session's own start() rethrows after writing turn.error +
      // marking the row 'error'. Nothing actionable here; the row
      // tells the renderer.
    })
    // Forget the run once it's no longer streaming. We can't await
    // completion here (start() returns immediately), so poll on a
    // microtask cadence until the active turn drains.
    void this.reapWhenIdle(session)
    return session
  }

  get(runId: string): TaskRunSession | undefined {
    return this.runs.get(runId)
  }

  forget(runId: string): void {
    this.runs.delete(runId)
  }

  async cancel(runId: string, reason?: string): Promise<void> {
    const session = this.runs.get(runId)
    if (!session) return
    await session.cancel(reason)
    this.runs.delete(runId)
  }

  async disposeAll(): Promise<void> {
    const all = [...this.runs.values()]
    this.runs.clear()
    await Promise.allSettled(all.map((s) => s.dispose()))
  }

  private async reapWhenIdle(session: TaskRunSession): Promise<void> {
    // setInterval is overkill — a setTimeout chain on a short tick
    // does the job and stops as soon as the run finalizes. Bounded
    // by the run's own lifetime (which has acpx-side timeouts).
    const tick = () => {
      if (!session.isStreaming) {
        this.runs.delete(session.id)
        return
      }
      setTimeout(tick, 500)
    }
    setTimeout(tick, 500)
  }
}

let instance: RunManager | null = null

export function getRunManager(): RunManager {
  if (!instance) instance = new RunManagerImpl()
  return instance
}
