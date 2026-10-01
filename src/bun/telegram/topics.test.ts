import { describe, expect, test } from 'bun:test'
import { rateLimitDelayMs, TelegramApiError, truncateTopicName } from './api'
import { isManagementCommand } from './commands.format'
import { decodeThreadId, topicRouteFor } from './topics'

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

describe('isManagementCommand', () => {
  test('recognises the pointer-based commands', () => {
    for (const cmd of ['/new', '/list', '/switch 2', '/archive']) {
      expect(isManagementCommand(cmd)).toBe(true)
    }
  })

  test('tolerates the @botname suffix Telegram adds in groups', () => {
    expect(isManagementCommand('/list@herbie_bot')).toBe(true)
  })

  // /help targets no conversation, so it stays usable inside a topic.
  test('leaves /help alone', () => {
    expect(isManagementCommand('/help')).toBe(false)
  })

  test('ignores ordinary text', () => {
    expect(isManagementCommand('list the files')).toBe(false)
  })
})

describe('rateLimitDelayMs', () => {
  function apiError(retryAfter?: string): TelegramApiError {
    const headers = new Headers()
    if (retryAfter !== undefined) headers.set('retry-after', retryAfter)
    return new TelegramApiError(
      'createForumTopic',
      'Too Many Requests',
      429,
      new Response(null, { headers }),
    )
  }

  // This is what separates "wait and try again" from "this will never
  // work", and the backfill only pauses when it returns a number.
  test('reports the wait Telegram asked for, in milliseconds', () => {
    expect(rateLimitDelayMs(apiError('7'))).toBe(7000)
  })

  test('reports nothing when Telegram sent no retry-after', () => {
    expect(rateLimitDelayMs(apiError())).toBeNull()
  })

  test('reports nothing for failures that are not from the Bot API', () => {
    expect(rateLimitDelayMs(new Error('socket hang up'))).toBeNull()
    expect(rateLimitDelayMs(null)).toBeNull()
  })
})

describe('topicRouteFor', () => {
  const withTopics = { topicsEnabled: true }
  const withoutTopics = { topicsEnabled: false }

  // The regression this exists to prevent. Gating on the connection's
  // kind meant an existing special-purpose bot could never reach the
  // feature, and kind cannot be changed after creation.
  test('routes by topic for any connection that has topics on', () => {
    expect(topicRouteFor(withTopics, 'telegram:42:7')).toEqual({
      telegramChatId: '42',
      messageThreadId: 7,
    })
  })

  test('declines when the chat has no topics, leaving the old path', () => {
    expect(topicRouteFor(withoutTopics, 'telegram:42:7')).toBeNull()
  })

  // The General topic is where messages land in a chat whose topics
  // were only just switched on; claiming it would steal the
  // conversation already in use.
  test('declines a message that arrived outside any topic', () => {
    expect(topicRouteFor(withTopics, 'telegram:42')).toBeNull()
  })

  test('declines a thread id from another adapter', () => {
    expect(topicRouteFor(withTopics, 'discord:42:7')).toBeNull()
  })
})
