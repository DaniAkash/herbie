import { describe, expect, test } from 'bun:test'
import type { PersistedEvent } from '../chat/events.types'
import {
  isTerminal,
  renderEvent,
  splitForTelegram,
  summariseToolCall,
  TELEGRAM_TEXT_LIMIT,
  terminalNotice,
} from './presenter'

function event(type: string, payload: unknown): PersistedEvent {
  return { conversationId: 'c', seq: 1, type, payload, createdAt: new Date() }
}

describe('splitForTelegram', () => {
  test('leaves a message that already fits alone', () => {
    expect(splitForTelegram('short')).toEqual(['short'])
  })

  // Telegram rejects anything over the limit, and the adapter truncates
  // rather than failing, so oversize text has to be split before it is
  // ever sent.
  test('keeps every chunk within the limit', () => {
    for (const chunk of splitForTelegram('x'.repeat(10_000))) {
      expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_TEXT_LIMIT)
    }
  })

  // Comparing with whitespace stripped would hide exactly the bug this
  // guards against: trimming each chunk eats indentation in code blocks
  // and list continuations.
  test('reproduces the input exactly when the chunks are concatenated', () => {
    const text = `${'a'.repeat(5000)}\n    indented continuation\n${'b'.repeat(2000)}`
    expect(splitForTelegram(text).join('')).toBe(text)
  })

  test('preserves indentation across a boundary', () => {
    const body = `${'a'.repeat(4000)}\n        deeply indented\n${'b'.repeat(500)}`
    expect(splitForTelegram(body).join('')).toBe(body)
  })

  test('prefers a paragraph boundary over a hard cut', () => {
    const head = 'a'.repeat(4000)
    const tail = 'b'.repeat(2000)
    const [first] = splitForTelegram(`${head}\n\n${tail}`)
    // Breaks at the blank line, so the whole paragraph stays together
    // and none of the next one leaks in.
    expect(first?.startsWith(head)).toBe(true)
    expect(first).not.toContain('b')
  })
})

describe('summariseToolCall', () => {
  test('names the tool and what it acted on', () => {
    expect(
      summariseToolCall({ toolName: 'read', input: { path: 'a.ts' } }),
    ).toBe('\n_read: a.ts_\n')
  })

  test('falls back to the tool alone when the target is unrecognised', () => {
    expect(summariseToolCall({ toolName: 'think', input: { depth: 3 } })).toBe(
      '\n_think_\n',
    )
  })

  test('truncates a very long target', () => {
    const out = summariseToolCall({
      toolName: 'run',
      input: { command: 'x'.repeat(500) },
    })
    expect(out?.length).toBeLessThan(120)
  })

  test('ignores payloads that are not tool calls', () => {
    expect(summariseToolCall(null)).toBeNull()
    expect(summariseToolCall({ input: { path: 'a' } })).toBeNull()
  })
})

describe('renderEvent', () => {
  test('passes assistant text through', () => {
    expect(renderEvent(event('assistant.text', { text: 'hi' }))).toBe('hi')
  })

  // Dropping tool activity entirely makes a working agent look hung.
  test('summarises a tool call rather than dropping it', () => {
    expect(
      renderEvent(event('tool.call', { toolName: 'edit', input: {} })),
    ).toBe('\n_edit_\n')
  })

  test('contributes nothing for events with no Telegram surface', () => {
    expect(renderEvent(event('reasoning.complete', { text: 'x' }))).toBeNull()
  })
})

describe('terminal events', () => {
  test('recognises every way a turn can end', () => {
    expect(isTerminal(event('turn.finish', {}))).toBe(true)
    expect(isTerminal(event('turn.error', {}))).toBe(true)
    expect(isTerminal(event('turn.cancel', {}))).toBe(true)
    expect(isTerminal(event('assistant.text', {}))).toBe(false)
  })

  test('surfaces an error instead of ending silently', () => {
    expect(terminalNotice(event('turn.error', { message: 'boom' }))).toContain(
      'boom',
    )
  })

  test('adds nothing to a clean finish', () => {
    expect(terminalNotice(event('turn.finish', {}))).toBeNull()
  })
})
