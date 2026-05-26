import {
  bindToolCallId,
  errorToString,
  patchToolByCallId,
  pushPart,
  type ReducerCtx,
  splitAcpxToolBlob,
  stringifyToolPayload,
} from './chat.reducer.parts'
import type { PersistedEventDTO } from './chat.types'

export function handleToolCall(ctx: ReducerCtx, ev: PersistedEventDTO): void {
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
  const rawInput = p.input === undefined ? '' : stringifyToolPayload(p.input)
  const split = splitAcpxToolBlob(rawInput)
  pushPart(ctx, {
    kind: 'tool',
    id: p.toolCallId,
    toolCallId: p.toolCallId,
    toolName: p.toolName ?? 'tool',
    input: split ? split.args : rawInput,
    output: null,
    isError: false,
    isPlaceholder: false,
    state: 'input-available',
  })
}

export function handleToolResult(ctx: ReducerCtx, ev: PersistedEventDTO): void {
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
  const rawStr = raw === undefined ? '' : stringifyToolPayload(raw)
  patchToolByCallId(ctx, p.toolCallId, (part) => {
    const split = splitAcpxToolBlob(rawStr)
    const nextInput = split ? split.args : part.input
    const nextOutput = split
      ? split.output
      : rawStr === part.input
        ? null
        : rawStr
    return {
      ...part,
      input: nextInput,
      output: nextOutput,
      state: p.isError ? 'output-error' : 'output-available',
      isError: !!p.isError,
    }
  })
}

export function handleToolError(ctx: ReducerCtx, ev: PersistedEventDTO): void {
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
