import { applyEvent, type ReducerCtx, rehydrateActive } from './chat.reducer'
import type { ChatViewState, PersistedEventDTO } from './chat.types'

export function emptyChatViewState(): ChatViewState {
  return { messages: [], isStreaming: false, lastSeq: -1 }
}

export function reduceChatEvents(
  initial: ChatViewState,
  events: PersistedEventDTO[],
): ChatViewState {
  const ctx: ReducerCtx = {
    messages: [...initial.messages],
    isStreaming: initial.isStreaming,
    activeAssistantIdx: -1,
    activeBlocks: new Map(),
  }
  rehydrateActive(ctx)

  let lastSeq = initial.lastSeq
  for (const ev of events) {
    if (ev.seq <= lastSeq) continue
    lastSeq = ev.seq
    applyEvent(ctx, ev)
  }

  return {
    messages: ctx.messages,
    isStreaming: ctx.isStreaming,
    lastSeq,
  }
}
