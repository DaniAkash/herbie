import type {
  ChatMessage,
  ChatViewState,
  PersistedEventDTO,
} from './chat.types'

export function emptyChatViewState(): ChatViewState {
  return { messages: [], isStreaming: false, lastSeq: -1 }
}

interface ReducerCtx {
  messages: ChatMessage[]
  isStreaming: boolean
  activeAssistantId: string | null
}

export function reduceChatEvents(
  initial: ChatViewState,
  events: PersistedEventDTO[],
): ChatViewState {
  const ctx: ReducerCtx = {
    messages: [...initial.messages],
    isStreaming: initial.isStreaming,
    activeAssistantId: lastActiveAssistantId(initial.messages),
  }
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

function applyEvent(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  switch (ev.type) {
    case 'turn.start':
      handleTurnStart(ctx, ev)
      break
    case 'turn.finish':
      handleTurnFinish(ctx)
      break
    case 'turn.cancel':
      handleTurnCancel(ctx)
      break
    case 'turn.error':
      handleTurnError(ctx, ev)
      break
    case 'stream.text-delta':
      handleTextDelta(ctx, ev)
      break
  }
}

function handleTurnStart(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { requestId: string; userMessage: string }
  ctx.messages.push({
    id: `u-${ev.seq}`,
    role: 'user',
    text: p.userMessage,
    createdAt: ev.createdAt,
    isStreaming: false,
    isCancelled: false,
    isError: false,
  })
  const assistantId = `a-${ev.seq}`
  ctx.messages.push({
    id: assistantId,
    role: 'assistant',
    text: '',
    createdAt: ev.createdAt,
    isStreaming: true,
    isCancelled: false,
    isError: false,
  })
  ctx.activeAssistantId = assistantId
  ctx.isStreaming = true
}

function handleTurnFinish(ctx: ReducerCtx): void {
  patchActive(ctx, (m) => ({ ...m, isStreaming: false }))
  closeActive(ctx)
}

function handleTurnCancel(ctx: ReducerCtx): void {
  patchActive(ctx, (m) => ({ ...m, isStreaming: false, isCancelled: true }))
  closeActive(ctx)
}

function handleTurnError(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { message: string; code?: string }
  patchActive(ctx, (m) => ({
    ...m,
    isStreaming: false,
    isError: true,
    errorMessage: p.message,
  }))
  closeActive(ctx)
}

function handleTextDelta(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { text?: string }
  if (!p.text) return
  const text = p.text
  patchActive(ctx, (m) => ({ ...m, text: m.text + text }))
}

function closeActive(ctx: ReducerCtx): void {
  ctx.isStreaming = false
  ctx.activeAssistantId = null
}

// Replace the active assistant message with a new object instead of mutating
// in place — the incremental reducer in chat.data.ts keeps the previous state
// alive across renders, and React relies on object identity for reconciliation.
function patchActive(
  ctx: ReducerCtx,
  patch: (m: ChatMessage) => ChatMessage,
): void {
  const id = ctx.activeAssistantId
  if (!id) return
  const idx = ctx.messages.findIndex((m) => m.id === id)
  if (idx < 0) return
  const old = ctx.messages[idx]
  if (!old) return
  ctx.messages[idx] = patch(old)
}

function lastActiveAssistantId(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m && m.role === 'assistant' && m.isStreaming) return m.id
  }
  return null
}
