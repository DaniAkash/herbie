import type { PersistedEvent } from './events.types'

export type ChatEventListener = (event: PersistedEvent) => void

export class EventBus {
  private readonly channels = new Map<string, Set<ChatEventListener>>()

  subscribe(conversationId: string, listener: ChatEventListener): () => void {
    let set = this.channels.get(conversationId)
    if (!set) {
      set = new Set()
      this.channels.set(conversationId, set)
    }
    set.add(listener)
    return () => {
      set?.delete(listener)
      if (set && set.size === 0) this.channels.delete(conversationId)
    }
  }

  emit(conversationId: string, event: PersistedEvent): void {
    const set = this.channels.get(conversationId)
    if (!set) return
    for (const listener of set) {
      try {
        listener(event)
      } catch {
        // A misbehaving subscriber must not block delivery to the rest.
      }
    }
  }
}

let instance: EventBus | null = null

export function getEventBus(): EventBus {
  if (!instance) instance = new EventBus()
  return instance
}
