import type { ModelMessage } from 'ai'

// Sums the character lengths of every text-bearing content piece across
// the messages array streamText is about to receive. Image / file
// binaries have no meaningful char count and are skipped — so this is
// strictly an estimate of the textual surface the agent sees. Cheap
// enough to compute synchronously on every send.
export function sumModelMessageChars(messages: ModelMessage[]): number {
  let total = 0
  for (const m of messages) {
    const content = m.content as unknown
    if (typeof content === 'string') {
      total += content.length
      continue
    }
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const p = part as { type?: string; text?: unknown }
      if (p.type === 'text' && typeof p.text === 'string') {
        total += p.text.length
      }
    }
  }
  return total
}
