import {
  errorToString,
  finalizeActiveMessage,
  patchActiveMessage,
  patchPart,
  patchToolByCallId,
  pushPart,
  type ReducerCtx,
  stringifyToolPayload,
} from './chat.reducer.parts'
import type {
  PersistedEventDTO,
  ReasoningPart,
  TextPart,
  ToolPart,
  ToolPartState,
} from './chat.types'

export type { ReducerCtx } from './chat.reducer.parts'
export { rehydrateActive } from './chat.reducer.parts'

const PLAN_PREFIX = '[Plan] '

export function applyEvent(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  switch (ev.type) {
    case 'turn.start':
      handleTurnStart(ctx, ev)
      break
    case 'turn.finish':
      finalizeActiveMessage(ctx, (m) => ({ ...m, isStreaming: false }))
      break
    case 'turn.cancel':
      finalizeActiveMessage(ctx, (m) => ({
        ...m,
        isStreaming: false,
        isCancelled: true,
      }))
      break
    case 'turn.error':
      handleTurnError(ctx, ev)
      break
    case 'stream.text-start':
      openTextBlock(ctx, ev)
      break
    case 'stream.text-delta':
      appendTextDelta(ctx, ev)
      break
    case 'stream.text-end':
      closeBlock(ctx, ev, 'text')
      break
    case 'stream.reasoning-start':
      openReasoningBlock(ctx, ev)
      break
    case 'stream.reasoning-delta':
      appendReasoningDelta(ctx, ev)
      break
    case 'stream.reasoning-end':
      closeBlock(ctx, ev, 'reasoning')
      break
    case 'stream.tool-input-start':
      openToolBlock(ctx, ev)
      break
    case 'stream.tool-input-delta':
      appendToolInputDelta(ctx, ev)
      break
    case 'stream.tool-input-end':
      transitionToolState(ctx, ev, 'input-available')
      break
    case 'stream.tool-call':
      handleToolCall(ctx, ev)
      break
    case 'stream.tool-result':
      handleToolResult(ctx, ev)
      break
    case 'stream.tool-error':
      handleToolError(ctx, ev)
      break
    case 'stream.error':
      handleStreamError(ctx, ev)
      break
    // Framing events with no UI surface — listed explicitly so a missing
    // handler for a new event type stays loud.
    case 'stream.start':
    case 'stream.start-step':
    case 'stream.finish-step':
    case 'stream.finish':
    case 'stream.abort':
    case 'meta.title':
      break
    default:
      break
  }
}

function handleTurnStart(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { requestId: string; userMessage: string }
  ctx.messages.push({
    id: `u-${ev.seq}`,
    role: 'user',
    parts: [
      { kind: 'text', id: `u-${ev.seq}`, text: p.userMessage, isOpen: false },
    ],
    createdAt: ev.createdAt,
    isStreaming: false,
    isCancelled: false,
    isError: false,
  })
  ctx.messages.push({
    id: `a-${ev.seq}`,
    role: 'assistant',
    parts: [],
    createdAt: ev.createdAt,
    isStreaming: true,
    isCancelled: false,
    isError: false,
  })
  ctx.activeAssistantIdx = ctx.messages.length - 1
  ctx.activeBlocks = new Map()
  ctx.isStreaming = true
}

function handleTurnError(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { message: string; code?: string }
  finalizeActiveMessage(ctx, (m) => ({
    ...m,
    isStreaming: false,
    isError: true,
    errorMessage: p.message,
  }))
}

function handleStreamError(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { error?: { message?: string } | string }
  const message =
    typeof p.error === 'string' ? p.error : (p.error?.message ?? 'stream error')
  patchActiveMessage(ctx, (m) => ({
    ...m,
    isError: true,
    errorMessage: m.errorMessage ?? message,
  }))
}

function openTextBlock(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { id: string }
  if (!p.id) return
  pushPart(ctx, { kind: 'text', id: p.id, text: '', isOpen: true })
}

function appendTextDelta(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { id?: string; text?: string }
  const text = p.text ?? ''
  if (!text) return
  patchPart<TextPart>(ctx, p.id, 'text', (part) => ({
    ...part,
    text: part.text + text,
  }))
}

function openReasoningBlock(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { id: string }
  if (!p.id) return
  pushPart(ctx, {
    kind: 'reasoning',
    id: p.id,
    text: '',
    isOpen: true,
    isPlan: false,
  })
}

function appendReasoningDelta(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { id?: string; text?: string }
  const delta = p.text ?? ''
  if (!delta) return
  patchPart<ReasoningPart>(ctx, p.id, 'reasoning', (part) => {
    const next = part.text + delta
    if (!part.isPlan && next.startsWith(PLAN_PREFIX)) {
      return { ...part, text: next.slice(PLAN_PREFIX.length), isPlan: true }
    }
    return { ...part, text: next }
  })
}

function closeBlock(
  ctx: ReducerCtx,
  ev: PersistedEventDTO,
  kind: 'text' | 'reasoning',
): void {
  const p = ev.payload as { id?: string }
  patchPart<TextPart | ReasoningPart>(ctx, p.id, kind, (part) => ({
    ...part,
    isOpen: false,
  }))
  if (p.id) ctx.activeBlocks.delete(p.id)
}

function openToolBlock(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { id: string; toolName?: string }
  if (!p.id) return
  pushPart(ctx, {
    kind: 'tool',
    id: p.id,
    toolCallId: p.id,
    toolName: p.toolName ?? 'tool',
    input: '',
    output: null,
    isError: false,
    state: 'input-streaming',
  })
}

function appendToolInputDelta(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { id?: string; delta?: string }
  const delta = p.delta ?? ''
  if (!delta) return
  patchPart<ToolPart>(ctx, p.id, 'tool', (part) => ({
    ...part,
    input: part.input + delta,
  }))
}

function transitionToolState(
  ctx: ReducerCtx,
  ev: PersistedEventDTO,
  state: ToolPartState,
): void {
  const p = ev.payload as { id?: string }
  patchPart<ToolPart>(ctx, p.id, 'tool', (part) => ({ ...part, state }))
}

function handleToolCall(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  // tool-input-* events identify the part by an internal block id (e.g.
  // "acpx-4"). The terminal tool-call event carries the agent's real
  // toolCallId (e.g. "toolu_01...") with no link back to the block id.
  // Bind by walking back from the latest tool part that hasn't received
  // a real toolCallId yet (its `toolCallId === id` placeholder set on
  // input-start). Without the bind, downstream tool-result / tool-error
  // lookups by toolCallId silently miss and the card stays "Running".
  const p = ev.payload as {
    toolCallId?: string
    toolName?: string
  }
  if (!p.toolCallId || ctx.activeAssistantIdx < 0) return
  const msg = ctx.messages[ctx.activeAssistantIdx]
  if (!msg) return
  for (let i = msg.parts.length - 1; i >= 0; i--) {
    const part = msg.parts[i]
    if (!part || part.kind !== 'tool') continue
    if (part.toolCallId !== part.id) continue
    const nextParts = [...msg.parts]
    nextParts[i] = {
      ...part,
      toolCallId: p.toolCallId,
      toolName: p.toolName ?? part.toolName,
    }
    ctx.messages[ctx.activeAssistantIdx] = { ...msg, parts: nextParts }
    return
  }
}

function handleToolResult(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as {
    toolCallId?: string
    output?: unknown
    result?: unknown
    isError?: boolean
  }
  if (!p.toolCallId) return
  // tool-result carries the canonical output. AI SDK V6 uses `output`;
  // acpx-ai-provider's V2 shape uses `result`. Read both defensively.
  const raw = p.output ?? p.result
  const output = raw === undefined ? '' : stringifyToolPayload(raw)
  patchToolByCallId(ctx, p.toolCallId, (part) => ({
    ...part,
    state: p.isError ? 'output-error' : 'output-available',
    isError: !!p.isError,
    output,
  }))
}

function handleToolError(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as {
    toolCallId?: string
    error?: unknown
    output?: unknown
  }
  if (!p.toolCallId) return
  const message = errorToString(p.error)
  patchToolByCallId(ctx, p.toolCallId, (part) => ({
    ...part,
    state: 'output-error',
    isError: true,
    errorMessage: message,
    output:
      part.output ??
      (p.output === undefined ? '' : stringifyToolPayload(p.output)),
  }))
}
