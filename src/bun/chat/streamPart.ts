import type { ProtocolEvent } from './events.types'

// AI SDK stream parts arrive as `{ type: '<subtype>', ...rest }`. These
// helpers narrow the unknown shape so ChatSession can stay focused on
// orchestration.

export function extractStreamSubtype(part: unknown): string {
  if (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    typeof (part as { type: unknown }).type === 'string'
  ) {
    return (part as { type: string }).type
  }
  return 'unknown'
}

function readTextPart(part: unknown): { id?: string; text?: string } {
  if (typeof part !== 'object' || part === null) return {}
  const o = part as Record<string, unknown>
  return {
    id: typeof o.id === 'string' ? o.id : undefined,
    text: typeof o.text === 'string' ? o.text : undefined,
  }
}

// Per-turn segment accumulator. Streamed deltas land in `add()` keyed
// by AI SDK block id; `flush()` returns the assembled text + clears
// the entry. Used for both text-* and reasoning-* coalescing.
export class SegmentBuffer {
  private readonly segments = new Map<string, string>()

  add(part: unknown): void {
    const { id, text } = readTextPart(part)
    if (!id || typeof text !== 'string') return
    this.segments.set(id, (this.segments.get(id) ?? '') + text)
  }

  flush(part: unknown): { id: string; text: string } | null {
    const { id } = readTextPart(part)
    if (!id) return null
    const text = this.segments.get(id) ?? ''
    this.segments.delete(id)
    return { id, text }
  }
}

export interface SegmentBuffers {
  text: SegmentBuffer
  reasoning: SegmentBuffer
}

// Routes a stream part through the right coalescer. For deltas, accumulates
// silently; for end-events, returns the terminal protocol event to write.
export function coalesceStreamPart(
  subtype: string,
  part: unknown,
  buffers: SegmentBuffers,
  requestId: string,
): ProtocolEvent | null {
  if (subtype === 'text-delta') buffers.text.add(part)
  if (subtype === 'reasoning-delta') buffers.reasoning.add(part)
  if (subtype === 'text-end') {
    const f = buffers.text.flush(part)
    if (f)
      return {
        type: 'assistant.text',
        payload: { requestId, textId: f.id, text: f.text },
      }
  }
  if (subtype === 'reasoning-end') {
    const f = buffers.reasoning.flush(part)
    if (f)
      return {
        type: 'reasoning.complete',
        payload: { requestId, reasoningId: f.id, text: f.text },
      }
  }
  return null
}
