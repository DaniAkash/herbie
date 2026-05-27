// Renderer reports which conversation is visibly focused. The
// notification dispatcher reads this to decide whether to fire a toast
// or suppress it because the user is already looking at the chat.
// In-memory because both producer and consumer live in this bun
// process and a stranded focus across restart is harmless.

const STALENESS_MS = 10_000

let current: { conversationId: string | null; updatedAt: number } | null = null

export function setCurrentFocus(conversationId: string | null): void {
  current = { conversationId, updatedAt: Date.now() }
}

export function getCurrentFocus(): { conversationId: string | null } {
  if (!current) return { conversationId: null }
  if (Date.now() - current.updatedAt > STALENESS_MS) {
    // Renderer hasn't heartbeat'd in 10s; treat as unfocused so a
    // crashed renderer doesn't keep notifications suppressed forever.
    return { conversationId: null }
  }
  return { conversationId: current.conversationId }
}
