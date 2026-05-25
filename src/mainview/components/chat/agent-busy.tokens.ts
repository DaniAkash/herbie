// Rough OpenAI-style heuristic: ~4 chars per token for English. Pessimistic
// on code-heavy content, optimistic on whitespace. Good enough for an
// at-a-glance indicator — do NOT use for billing or quota math.
const CHARS_PER_TOKEN = 4

export function approxTokensFromChars(chars: number): number {
  if (chars <= 0) return 0
  return Math.ceil(chars / CHARS_PER_TOKEN)
}

// Compact formatter — keeps the AgentBusy row inside its width budget
// once token counts climb past 1k. 1234 → "1.2K", 12345 → "12K".
export function formatTokenCount(n: number): string {
  if (n < 1000) return String(n)
  const k = n / 1000
  return n < 10_000 ? `${k.toFixed(1)}K` : `${Math.round(k)}K`
}
