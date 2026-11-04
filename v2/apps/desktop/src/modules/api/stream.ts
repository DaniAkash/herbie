import { rawFetch } from '@/modules/api/client'

/**
 * Server-sent events, read by hand rather than with `EventSource`.
 *
 * `EventSource` cannot be handed a custom fetch, and in the desktop window
 * every request goes through `@tauri-apps/plugin-http` because the webview
 * origin is never same origin with 127.0.0.1 and the alternative is
 * permissive CORS on a server that drives coding agents. So `EventSource`
 * would work on the browser development path and fail in the window, which
 * is the worst shape a bug can have.
 *
 * `plugin-http` returns a real `ReadableStream` whose `pull` fetches the next
 * chunk over ipc, so a reader and a `TextDecoder` is all this needs. One
 * reader, both hosts.
 */

export interface StreamHandlers {
  readonly onEvent: (event: string, data: string) => void
  /** Called when the connection drops, with whether it was deliberate. */
  readonly onClose?: (aborted: boolean) => void
  readonly onError?: (cause: unknown) => void
}

/** Frames split on a blank line, and a field is `name: value`. */
function dispatch(frame: string, onEvent: StreamHandlers['onEvent']): void {
  let event = 'message'
  const data: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue
    const at = line.indexOf(':')
    const name = at === -1 ? line : line.slice(0, at)
    const value = at === -1 ? '' : line.slice(at + 1).replace(/^ /, '')
    if (name === 'event') event = value
    else if (name === 'data') data.push(value)
  }
  if (data.length > 0) onEvent(event, data.join('\n'))
}

/**
 * Dispatches every whole frame in the buffer and returns what is left.
 *
 * A partial frame stays: a chunk boundary falls wherever the transport put
 * it, which over ipc is nowhere near where the SSE framing is.
 */
function drain(buffer: string, onEvent: StreamHandlers['onEvent']): string {
  let rest = buffer
  let split = rest.indexOf('\n\n')
  while (split !== -1) {
    dispatch(rest.slice(0, split), onEvent)
    rest = rest.slice(split + 2)
    split = rest.indexOf('\n\n')
  }
  return rest
}

export function openStream(path: string, handlers: StreamHandlers): () => void {
  const controller = new AbortController()

  void (async () => {
    try {
      const response = await rawFetch(path, {
        signal: controller.signal,
        headers: { accept: 'text/event-stream' },
      })
      if (!response.ok || !response.body) {
        throw new Error(`stream refused: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        buffer = drain(buffer, handlers.onEvent)
      }
      handlers.onClose?.(controller.signal.aborted)
    } catch (cause) {
      if (controller.signal.aborted) {
        handlers.onClose?.(true)
        return
      }
      handlers.onError?.(cause)
      handlers.onClose?.(false)
    }
  })()

  return () => controller.abort()
}
