import type { PersistedEvent } from './events.types'

export type ChatEventListener = (event: PersistedEvent) => void

export interface EventBus {
  subscribe(conversationId: string, listener: ChatEventListener): () => void
  // Cross-conversation listeners. Used by the notification dispatcher
  // which needs to see every emit regardless of which chat fired it.
  subscribeAll(listener: ChatEventListener): () => void
  emit(conversationId: string, event: PersistedEvent): void
}

class EventBusImpl implements EventBus {
  private readonly channels = new Map<string, Set<ChatEventListener>>()
  private readonly wildcards = new Set<ChatEventListener>()

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

  subscribeAll(listener: ChatEventListener): () => void {
    this.wildcards.add(listener)
    return () => {
      this.wildcards.delete(listener)
    }
  }

  emit(conversationId: string, event: PersistedEvent): void {
    const set = this.channels.get(conversationId)
    if (set) {
      for (const listener of set) {
        try {
          listener(event)
        } catch {
          // A misbehaving subscriber must not block delivery to the rest.
        }
      }
    }
    for (const listener of this.wildcards) {
      try {
        listener(event)
      } catch {}
    }
  }
}

let instance: EventBus | null = null

export function getEventBus(): EventBus {
  if (!instance) instance = new EventBusImpl()
  return instance
}
