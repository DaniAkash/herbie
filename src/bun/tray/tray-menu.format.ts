import { basename } from 'node:path'

const MAX_LABEL = 60

// `primary — folder` packed into ≤MAX_LABEL chars. The primary side
// gets truncated with an ellipsis when needed; the folder suffix
// stays intact so the user always sees workspace context.
export function formatLabel(primary: string, folder: string | null): string {
  const cleaned = primary.replace(/\s+/g, ' ').trim() || 'Untitled'
  if (!folder) return truncate(cleaned, MAX_LABEL)
  const suffix = ` — ${folder}`
  const maxPrimary = Math.max(8, MAX_LABEL - suffix.length)
  return `${truncate(cleaned, maxPrimary)}${suffix}`
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1))}…`
}

export function basenameOrNull(p: string | null): string | null {
  if (!p) return null
  // basename('/') is '' on POSIX — collapse to null so the formatter
  // skips the suffix instead of rendering `Foo — ` with a dangling
  // em-dash.
  const name = basename(p)
  return name.length > 0 ? name : null
}

// Empty when 0, single digit when 1-9, `9+` otherwise. Electrobun's
// tray.setTitle('') hides the text next to the icon so the menubar
// stays clean when there's nothing pending.
export function formatBadge(count: number): string {
  if (count <= 0) return ''
  if (count > 9) return '9+'
  return String(count)
}
