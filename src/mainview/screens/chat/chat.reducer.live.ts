// Reducer cases that consume the bus's live stream events
// (stream.text-*, stream.reasoning-*, stream.tool-input-*). These build
// up message parts incrementally during a turn. Replay handlers (in
// chat.reducer.ts) push a single closed part for each block.

import { patchPart, pushPart, type ReducerCtx } from './chat.reducer.parts'
import type {
  PersistedEventDTO,
  ReasoningPart,
  TextPart,
  ToolPart,
  ToolPartState,
} from './chat.types'

const PLAN_PREFIX = '[Plan] '

export function openTextBlock(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { id: string }
  if (!p.id) return
  pushPart(ctx, { kind: 'text', id: p.id, text: '', isOpen: true })
}

export function appendTextDelta(ctx: ReducerCtx, ev: PersistedEventDTO): void {
  const p = ev.payload as { id?: string; text?: string }
  const text = p.text ?? ''
  if (!text) return
  patchPart<TextPart>(ctx, p.id, 'text', (part) => ({
    ...part,
    text: part.text + text,
  }))
  bumpLiveOutputChars(ctx, text.length)
}

export function openReasoningBlock(
  ctx: ReducerCtx,
  ev: PersistedEventDTO,
): void {
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

export function appendReasoningDelta(
  ctx: ReducerCtx,
  ev: PersistedEventDTO,
): void {
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
  bumpLiveOutputChars(ctx, delta.length)
}

// AgentBusy reads liveOutputChars off ctx.activeAssistant for its
// output-token estimate. Append-only — never decremented. All
// terminal events (turn.finish / cancel / error) flow through
// finalizeActiveMessage which clears activeAssistant entirely, so
// this counter never needs rollback logic.
function bumpLiveOutputChars(ctx: ReducerCtx, delta: number): void {
  if (!ctx.activeAssistant || delta <= 0) return
  ctx.activeAssistant = {
    ...ctx.activeAssistant,
    liveOutputChars: ctx.activeAssistant.liveOutputChars + delta,
  }
}

export function closeBlock(
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

export function openToolBlock(ctx: ReducerCtx, ev: PersistedEventDTO): void {
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

export function appendToolInputDelta(
  ctx: ReducerCtx,
  ev: PersistedEventDTO,
): void {
  const p = ev.payload as { id?: string; delta?: string }
  const delta = p.delta ?? ''
  if (!delta) return
  patchPart<ToolPart>(ctx, p.id, 'tool', (part) => ({
    ...part,
    input: part.input + delta,
  }))
}

export function transitionToolState(
  ctx: ReducerCtx,
  ev: PersistedEventDTO,
  state: ToolPartState,
): void {
  const p = ev.payload as { id?: string }
  patchPart<ToolPart>(ctx, p.id, 'tool', (part) => ({ ...part, state }))
}
