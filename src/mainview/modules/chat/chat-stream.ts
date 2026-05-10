const API_BASE_URL = 'http://127.0.0.1:4575'

export interface ChatStreamEvent {
  seq: number
  type: string
  payload: unknown
  createdAt: number
}

export interface OpenChatStreamOptions {
  afterSeq?: number
  onEvent: (event: ChatStreamEvent) => void
  onError?: (err: Event) => void
}

export interface ChatStreamHandle {
  close(): void
}

export function openChatStream(
  conversationId: string,
  opts: OpenChatStreamOptions,
): ChatStreamHandle {
  const url = new URL(
    `/chat/${encodeURIComponent(conversationId)}/stream`,
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
