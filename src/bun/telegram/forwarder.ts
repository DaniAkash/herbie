import type { Thread } from 'chat'
import { getEventBus } from '../chat/eventBus'
import type { PersistedEvent } from '../chat/events.types'

// Subscribes to the chat event bus for a single turn and forwards
// assistant text + terminal events to a Telegram thread. Resolves
// when the matching terminal event arrives (turn.finish / turn.error
// / turn.cancel) so the caller can await the full reply.
export function streamTurnToThread(
  conversationId: string,
  requestId: string,
  thread: Thread,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const unsubscribe = getEventBus().subscribe(
      conversationId,
      (event: PersistedEvent) => {
        if (!isForThisTurn(event, requestId)) return
        const done = forwardEventToThread(event, thread)
        if (done) {
          unsubscribe()
          resolve()
        }
      },
    )
  })
}

// Returns true when the event is terminal — the caller should
// unsubscribe and resolve the awaiting promise.
function forwardEventToThread(event: PersistedEvent, thread: Thread): boolean {
  if (event.type === 'assistant.text') {
    const payload = event.payload as { text?: string }
    if (payload.text) void thread.post(payload.text)
    return false
  }
  if (event.type === 'turn.error') {
    const payload = event.payload as { message?: string }
    void thread.post(`❌ Error: ${payload.message ?? 'unknown error'}`)
    return true
  }
  if (event.type === 'turn.finish') return true
  if (event.type === 'turn.cancel') {
    void thread.post('Cancelled.')
    return true
  }
  return false
}

function isForThisTurn(event: PersistedEvent, requestId: string): boolean {
  const payload = event.payload as { requestId?: string } | null
  return payload?.requestId === requestId
}
