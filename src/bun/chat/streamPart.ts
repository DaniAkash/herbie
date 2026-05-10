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

// Per-turn text accumulator. Streamed deltas land in `add()` keyed by
// AI SDK textId; `flush()` returns the assembled text + clears it.
export class TextSegmentBuffer {
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
