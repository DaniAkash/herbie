import {
  appendReasoningDelta,
  appendTextDelta,
  appendToolInputDelta,
  closeBlock,
  openReasoningBlock,
  openTextBlock,
  openToolBlock,
  transitionToolState,
} from './chat.reducer.live'
import {
  bindToolCallId,
  errorToString,
  finalizeActiveMessage,
  patchActiveMessage,
  patchToolByCallId,
  pushPart,
  type ReducerCtx,
  stringifyToolPayload,
} from './chat.reducer.parts'
import type { PersistedEventDTO } from './chat.types'

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
    case 'assistant.text':
      handleAssistantText(ctx, ev)
      break
    case 'reasoning.complete':
      handleReasoningComplete(ctx, ev)
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
    case 'tool.call':
      handleToolCall(ctx, ev)
      break
    case 'tool.result':
      handleToolResult(ctx, ev)
      break
    case 'tool.error':
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
      // turn.* and stream.* are our two namespaces; an unrecognised one
      // means a new SDK part shipped without a handler. Warn so the gap
      // surfaces in dev console instead of failing silently. Don't throw —
      // the UI shouldn't brick on a future event type.
      if (ev.type.startsWith('turn.') || ev.type.startsWith('stream.')) {
        // biome-ignore lint/suspicious/noConsole: dev-time signal for missing reducer handlers
        console.warn('[chat.reducer] unhandled event type:', ev.type)
      }
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

// During a live turn the bus emits this event right before stream.text-end
// (ChatSession flushes the segment before emitting the end marker). The
// live deltas have already filled the open TextPart, so no-op when an
// active block with this id exists. On replay there's no live part —
// push a fresh closed one.
function handleAssistantText(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { textId: string; text: string }
  if (!p.textId) return
  if (ctx.activeBlocks.has(p.textId)) return
  pushPart(ctx, {
    kind: 'text',
    id: p.textId,
    text: p.text ?? '',
    isOpen: false,
  })
}

// Same idempotency guard as handleAssistantText. isPlan derivation
// matches the live appendReasoningDelta path.
function handleReasoningComplete(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { reasoningId: string; text: string }
  if (!p.reasoningId) return
  if (ctx.activeBlocks.has(p.reasoningId)) return
  const raw = p.text ?? ''
  const isPlan = raw.startsWith(PLAN_PREFIX)
  pushPart(ctx, {
    kind: 'reasoning',
    id: p.reasoningId,
    text: isPlan ? raw.slice(PLAN_PREFIX.length) : raw,
    isOpen: false,
    isPlan,
  })
}

function handleToolCall(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as {
    toolCallId?: string
    toolName?: string
    input?: unknown
  }
  if (!p.toolCallId) return
  // Live path: a placeholder ToolPart was opened by stream.tool-input-start.
  // Bind it. Replay path: no placeholder exists, so push a fresh closed
  // ToolPart with the assembled input.
  const bound = bindToolCallId(ctx, p.toolCallId, p.toolName)
  if (bound) return
  pushPart(ctx, {
    kind: 'tool',
    id: p.toolCallId,
    toolCallId: p.toolCallId,
    toolName: p.toolName ?? 'tool',
    input: p.input === undefined ? '' : stringifyToolPayload(p.input),
    output: null,
    isError: false,
    state: 'input-available',
  })
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
