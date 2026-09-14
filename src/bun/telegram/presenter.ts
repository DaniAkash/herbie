import type { PersistedEvent } from '../chat/events.types'

// Telegram rejects messages over 4,096 characters. The adapter
// truncates rather than failing, which silently loses the tail of a
// long answer, so the presenter splits before it gets that far.
export const TELEGRAM_TEXT_LIMIT = 4096

// Leaves headroom so a boundary search never has to cut at the exact
// limit.
const SPLIT_AT = TELEGRAM_TEXT_LIMIT - 64

// How much a single streamed message may accumulate before the rest is
// carried into follow-up messages.
export const STREAM_BUDGET = SPLIT_AT

/**
 * Splits text into Telegram-sized chunks, preferring a paragraph or
 * line boundary near the limit so a break never lands mid-sentence
 * when it does not have to.
 */
export function splitForTelegram(text: string): string[] {
  if (text.length <= TELEGRAM_TEXT_LIMIT) return [text]

  const chunks: string[] = []
  let rest = text
  while (rest.length > TELEGRAM_TEXT_LIMIT) {
    const window = rest.slice(0, SPLIT_AT)
    const at = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'))
    // No usable boundary means a single very long line; a hard cut is
    // the only option left.
    const cut = at > SPLIT_AT / 2 ? at : SPLIT_AT
    chunks.push(rest.slice(0, cut).trimEnd())
    rest = rest.slice(cut).trimStart()
  }
  if (rest.length > 0) chunks.push(rest)
  return chunks
}

interface ToolCallPayload {
  toolName?: string
  input?: unknown
}

/**
 * One line standing in for a tool call.
 *
 * Telegram cannot render the tool tree the desktop shows, and dropping
 * tool activity entirely makes a working agent look hung. A single
 * line per call keeps the thread readable while still showing that
 * something happened, and which file it happened to.
 */
export function summariseToolCall(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { toolName, input } = payload as ToolCallPayload
  if (!toolName) return null

  const target = describeToolTarget(input)
  return target ? `\n_${toolName}: ${target}_\n` : `\n_${toolName}_\n`
}

// Most agents name the thing they are acting on with one of these.
// Anything else is left unlabelled rather than dumping raw JSON into
// the chat.
const TARGET_KEYS = [
  'path',
  'file_path',
  'filePath',
  'command',
  'pattern',
  'query',
  'url',
] as const

function describeToolTarget(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null
  for (const key of TARGET_KEYS) {
    if (!(key in input)) continue
    const value = (input as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) {
      return value.length > 80 ? `${value.slice(0, 79)}…` : value
    }
  }
  return null
}

/**
 * Text a single event contributes to the streamed reply, or null when
 * it contributes nothing.
 */
export function renderEvent(event: PersistedEvent): string | null {
  if (event.type === 'assistant.text') {
    const { text } = event.payload as { text?: string }
    return text ?? null
  }
  if (event.type === 'tool.call') return summariseToolCall(event.payload)
  return null
}

export function isTerminal(event: PersistedEvent): boolean {
  return (
    event.type === 'turn.finish' ||
    event.type === 'turn.error' ||
    event.type === 'turn.cancel'
  )
}

export function terminalNotice(event: PersistedEvent): string | null {
  if (event.type === 'turn.error') {
    const { message } = event.payload as { message?: string }
    return `\n\n❌ ${message ?? 'unknown error'}`
  }
  if (event.type === 'turn.cancel') return '\n\n_Cancelled._'
  return null
}
