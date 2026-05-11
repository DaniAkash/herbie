import { API_BASE_URL } from '@/modules/api/client'

// Parallel to modules/chat/chat-stream.ts. Kept separate so the URL
// scheme + event shape can drift independently — task runs are
// single-turn and may eventually surface additional meta events that
// chat doesn't need.

export interface TaskRunStreamEvent {
  seq: number
  type: string
  payload: unknown
  createdAt: number
}

export interface OpenTaskRunStreamOptions {
  afterSeq?: number
  onEvent: (event: TaskRunStreamEvent) => void
  onError?: (err: Event) => void
}

export interface TaskRunStreamHandle {
  close(): void
}

export function openTaskRunStream(
  taskId: string,
  runId: string,
  opts: OpenTaskRunStreamOptions,
): TaskRunStreamHandle {
  const url = new URL(
    `/tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/stream`,
    API_BASE_URL,
  )
  if (opts.afterSeq !== undefined && opts.afterSeq >= 0) {
    url.searchParams.set('after', String(opts.afterSeq))
  }

  const es = new EventSource(url.toString())

  es.onmessage = (msg) => {
    const seq = msg.lastEventId ? Number.parseInt(msg.lastEventId, 10) : -1
    if (!Number.isFinite(seq)) return
    let parsed: { type: string; payload: unknown; createdAt: number }
    try {
      parsed = JSON.parse(msg.data)
    } catch {
      return
    }
    opts.onEvent({
      seq,
      type: parsed.type,
      payload: parsed.payload,
      createdAt: parsed.createdAt,
    })
  }

  if (opts.onError) es.onerror = opts.onError

  return {
    close() {
      es.close()
    },
  }
}
