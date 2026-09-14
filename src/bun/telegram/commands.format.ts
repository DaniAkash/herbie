// Small formatting helpers shared across command handlers. Kept in
// their own file so the handler modules stay under the line cap.

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

export function formatRecency(updatedAt: Date): string {
  const diffMs = Date.now() - updatedAt.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return `${Math.floor(day / 7)}w ago`
}

// The management commands all act on the chat-level active pointer, so
// they have no meaning inside a topic, where the topic itself is the
// selection. /help is not one of them: it targets no conversation.
const MANAGEMENT_COMMANDS = new Set([
  'new',
  'list',
  'switch',
  'current',
  'archive',
  'unarchive',
])

export function isManagementCommand(text: string): boolean {
  if (!text.startsWith('/')) return false
  const name = text.slice(1).split(/[\s@]/)[0]?.toLowerCase()
  return name !== undefined && MANAGEMENT_COMMANDS.has(name)
}
