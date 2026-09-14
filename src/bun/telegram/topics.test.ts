import { describe, expect, test } from 'bun:test'
import { truncateTopicName } from './api'
import { decodeThreadId } from './topics'

describe('decodeThreadId', () => {
  test('reads a topic id off a threaded chat', () => {
    expect(decodeThreadId('telegram:12345:67')).toEqual({
      telegramChatId: '12345',
      messageThreadId: 67,
    })
  })

  test('reports no topic for a plain chat', () => {
    expect(decodeThreadId('telegram:12345')).toEqual({
      telegramChatId: '12345',
      messageThreadId: null,
    })
  })

  // Group and channel ids are negative, so the sign must not be
  // mistaken for a separator.
  test('keeps negative chat ids intact', () => {
    expect(decodeThreadId('telegram:-1001234567890:12')).toEqual({
      telegramChatId: '-1001234567890',
      messageThreadId: 12,
    })
    expect(decodeThreadId('telegram:-1001234567890')).toEqual({
      telegramChatId: '-1001234567890',
      messageThreadId: null,
    })
  })

  test('treats a non-numeric tail as part of the chat id', () => {
    expect(decodeThreadId('telegram:abc:def')).toEqual({
      telegramChatId: 'abc:def',
      messageThreadId: null,
    })
  })

  test('rejects a thread id from another adapter', () => {
    expect(decodeThreadId('discord:12345:67')).toBeNull()
  })
})

describe('truncateTopicName', () => {
  test('leaves a normal title alone', () => {
    expect(truncateTopicName('codex silent failure')).toBe(
      'codex silent failure',
    )
  })

  test('falls back rather than sending an empty name', () => {
    expect(truncateTopicName('   ')).toBe('Untitled')
  })

  // Telegram rejects names over 128 characters outright, so the cap
  // has to be applied before the call rather than handled after it.
  test('caps an over-long title at the Telegram limit', () => {
    const out = truncateTopicName('x'.repeat(200))
    expect([...out]).toHaveLength(128)
    expect(out.endsWith('…')).toBe(true)
  })

  test('counts astral characters as single characters', () => {
    const out = truncateTopicName('🙂'.repeat(200))
    expect([...out]).toHaveLength(128)
  })
})
