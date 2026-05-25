import type {
  ActiveAssistant,
  ChatMessage,
  MessagePart,
  ToolPart,
} from './chat.types'

export interface ReducerCtx {
  messages: ChatMessage[]
  isStreaming: boolean
  // Active assistant message index — updated on turn.start, cleared on
  // any terminal turn.* event.
  activeAssistantIdx: number
  // Block id → part index within the active assistant message. Block
  // ids are unique per AI SDK stream block; cleared on turn.start.
  activeBlocks: Map<string, number>
  // Metadata about the currently-streaming turn, surfaced to the UI
  // via AgentBusy. Set on turn.start, updated by delta accumulators
  // + meta.turn-input, cleared on finalize.
  activeAssistant?: ActiveAssistant
}

export function pushPart(ctx: ReducerCtx, part: MessagePart): void {
  if (ctx.activeAssistantIdx < 0) return
  const msg = ctx.messages[ctx.activeAssistantIdx]
  if (!msg) return
  const nextParts = [...msg.parts, part]
  ctx.messages[ctx.activeAssistantIdx] = { ...msg, parts: nextParts }
  ctx.activeBlocks.set(part.id, nextParts.length - 1)
}

export function patchPart<T extends MessagePart>(
  ctx: ReducerCtx,
  id: string | undefined,
  kind: T['kind'],
  patch: (part: T) => T,
): void {
  if (!id || ctx.activeAssistantIdx < 0) return
  const msg = ctx.messages[ctx.activeAssistantIdx]
  if (!msg) return
  const idx =
    ctx.activeBlocks.get(id) ?? msg.parts.findIndex((p) => p.id === id)
  if (idx < 0) return
  const part = msg.parts[idx]
  if (!part || part.kind !== kind) return
  const nextParts = [...msg.parts]
  nextParts[idx] = patch(part as T)
  ctx.messages[ctx.activeAssistantIdx] = { ...msg, parts: nextParts }
}

// tool-input-* events identify the part by an internal block id (e.g.
// "acpx-4"). The terminal tool-call event carries the agent's real
// toolCallId (e.g. "toolu_01..."). Bind the latest tool part whose
// isPlaceholder flag is still set so downstream tool-result /
// tool-error lookups resolve. Returns true when a placeholder was bound
// — false on replay (no in-flight placeholder existed) or when the
// provider skipped the input-streaming prelude entirely (codex, etc).
//
// The previous predicate was `toolCallId !== id`, which also matched
// direct-path tool parts pushed by handleToolCall when no streaming
// prelude existed — causing sequential tool.call events to cascade-
// rebind the previous tool's part. isPlaceholder is set true only by
// openToolBlock in chat.reducer.live.ts and cleared on bind here.
export function bindToolCallId(
  ctx: ReducerCtx,
  toolCallId: string,
  toolName: string | undefined,
): boolean {
  if (ctx.activeAssistantIdx < 0) return false
  const msg = ctx.messages[ctx.activeAssistantIdx]
  if (!msg) return false
  for (let i = msg.parts.length - 1; i >= 0; i--) {
    const part = msg.parts[i]
    if (!part || part.kind !== 'tool') continue
    if (!part.isPlaceholder) continue
    const nextParts = [...msg.parts]
    nextParts[i] = {
      ...part,
      toolCallId,
      toolName: toolName ?? part.toolName,
      isPlaceholder: false,
    }
    ctx.messages[ctx.activeAssistantIdx] = { ...msg, parts: nextParts }
    return true
  }
  return false
}

export function patchToolByCallId(
  ctx: ReducerCtx,
  toolCallId: string,
  patch: (part: ToolPart) => ToolPart,
): void {
  if (ctx.activeAssistantIdx < 0) return
  const msg = ctx.messages[ctx.activeAssistantIdx]
  if (!msg) return
  const idx = msg.parts.findIndex(
    (p) => p.kind === 'tool' && p.toolCallId === toolCallId,
  )
  if (idx < 0) return
  const part = msg.parts[idx]
  if (!part || part.kind !== 'tool') return
  const nextParts = [...msg.parts]
  nextParts[idx] = patch(part)
  ctx.messages[ctx.activeAssistantIdx] = { ...msg, parts: nextParts }
}

export function patchActiveMessage(
  ctx: ReducerCtx,
  patch: (m: ChatMessage) => ChatMessage,
): void {
  if (ctx.activeAssistantIdx < 0) return
  const msg = ctx.messages[ctx.activeAssistantIdx]
  if (!msg) return
  ctx.messages[ctx.activeAssistantIdx] = patch(msg)
}

export function finalizeActiveMessage(
  ctx: ReducerCtx,
  patch: (m: ChatMessage) => ChatMessage,
): void {
  if (ctx.activeAssistantIdx < 0) {
    ctx.isStreaming = false
    ctx.activeAssistant = undefined
    return
  }
  const msg = ctx.messages[ctx.activeAssistantIdx]
  if (!msg) return
  // Close any still-open text/reasoning parts so the renderer stops
  // shimmering after the turn settles.
  const closedParts = msg.parts.map((part) =>
    'isOpen' in part && part.isOpen ? { ...part, isOpen: false } : part,
  )
  ctx.messages[ctx.activeAssistantIdx] = patch({ ...msg, parts: closedParts })
  ctx.isStreaming = false
  ctx.activeAssistantIdx = -1
  ctx.activeBlocks = new Map()
  ctx.activeAssistant = undefined
}

export function rehydrateActive(ctx: ReducerCtx): void {
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    const m = ctx.messages[i]
    if (m && m.role === 'assistant' && m.isStreaming) {
      ctx.activeAssistantIdx = i
      m.parts.forEach((part, idx) => {
        if ('isOpen' in part && part.isOpen) ctx.activeBlocks.set(part.id, idx)
        if (part.kind === 'tool' && part.state !== 'output-available') {
          ctx.activeBlocks.set(part.id, idx)
        }
      })
      return
    }
  }
}

export function stringifyToolPayload(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

// acpx-ai-provider's finalizeToolCall puts state.emittedText into BOTH
// tool-call.input AND tool-result.result for codex flows — there is no
// distinct output field, just one accumulating blob. The blob's format
// (codex CLI's text stream) interleaves the tool args, a status marker,
// and (optionally) the actual tool output in a fenced block.
//
// Common variants observed:
//   "<args> (in_progress)tool call: ```sh\n<output>\n```"
//   "<args> (in_progress)tool call (failed): <error>"
//   "<args> (in_progress)tool call (completed)"
//   "<args> (in_progress): <repeated args>...tool call (completed)"  // web search
//
// This helper splits the blob into args and a clean output string. If
// the marker isn't found, it's not the acpx codex flow (anthropic /
// openai-direct emit structured tool.call payloads) and we leave the
// caller's normal handling intact.
const ACPX_STATUS_MARKER = ' (in_progress)'

export function splitAcpxToolBlob(
  s: string,
): { args: string; output: string | null } | null {
  const idx = s.indexOf(ACPX_STATUS_MARKER)
  if (idx < 0) return null
  const args = s.slice(0, idx).trim()
  let rest = s.slice(idx + ACPX_STATUS_MARKER.length)
  // Strip the various leading status sub-markers in order of specificity.
  rest = rest
    .replace(/^tool call\s*\([^)]*\)\s*:?\s*/, '')
    .replace(/^tool call\s*:?\s*/, '')
    .replace(/^:\s*/, '')
    .trim()
  // Strip surrounding fenced code block (```sh / ```bash / ``` / etc).
  rest = rest
    .replace(/^```\w*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim()
  // Status-only completions ("tool call (completed)" with no real output)
  // and the web-search variant where rest is a repeat of args followed by
  // a status marker — neither carries new information. Drop them.
  if (!rest || /^tool call\b/.test(rest)) {
    return { args, output: null }
  }
  if (args && rest.startsWith(args)) {
    const tail = rest.slice(args.length).trim()
    if (!tail || /^tool call\b/.test(tail)) {
      return { args, output: null }
    }
  }
  return { args, output: rest }
}

export function errorToString(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}
