import { nanoid } from 'nanoid'

// Per-run capture channel for the herbie__task_result MCP tool.
// TaskRunSession registers a run and gets back a token + a promise;
// the spawned MCP child POSTs the markdown to an internal HTTP route,
// which calls `receive(token, markdown)`, which resolves the promise.
// All in-memory — in-flight runs don't survive a restart (boot
// recovery already cancels them).

interface Pending {
  runId: string
  resolve: (markdown: string) => void
}

export interface RegisteredCapture {
  token: string
  // Resolves to the markdown when the MCP child POSTs it; resolves to
  // null on dispose() so awaiters never hang.
  promise: Promise<string | null>
  dispose: () => void
}

export class TaskResultCapture {
  private readonly pending = new Map<string, Pending>()

  registerRun(runId: string): RegisteredCapture {
    const token = nanoid(32)
    let resolve!: (markdown: string | null) => void
    const promise = new Promise<string | null>((r) => {
      resolve = r
    })
    this.pending.set(token, {
      runId,
      resolve: (markdown: string) => resolve(markdown),
    })
    return {
      token,
      promise,
      dispose: () => {
        const entry = this.pending.get(token)
        if (!entry) return
        this.pending.delete(token)
        // Resolve the awaiter so finalize() doesn't hang waiting for a
        // POST that will never come.
        resolve(null)
      },
    }
  }

  // Called by the internal HTTP route. Returns false when the token is
  // unknown, already used, or has been disposed — the route then 404s.
  receive(token: string, markdown: string): boolean {
    const entry = this.pending.get(token)
    if (!entry) return false
    this.pending.delete(token)
    entry.resolve(markdown)
    return true
  }
}

let instance: TaskResultCapture | null = null

export function getTaskResultCapture(): TaskResultCapture {
  if (!instance) instance = new TaskResultCapture()
  return instance
}
