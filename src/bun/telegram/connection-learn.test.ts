import { describe, expect, test } from 'bun:test'
import type { TelegramConnection } from '../../db/schema/telegram-connections.sql'
import { learnedConnectionFields } from './connection-learn'

function connection(
  over: Partial<TelegramConnection> = {},
): TelegramConnection {
  const now = new Date()
  return {
    id: 'conn-1',
    name: 'Herbie',
    botUsername: 'herbie_bot',
    botTokenEncrypted: 'enc',
    kind: 'remote_control',
    defaultConversationId: null,
    agentId: 'claude',
    modelId: null,
    workspacePath: '/w',
    reasoningEffort: null,
    dmChatId: null,
    topicsEnabled: false,
    status: 'active',
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  } as TelegramConnection
}

describe('learnedConnectionFields', () => {
  test('records the DM chat id the first time the user speaks', () => {
    const patch = learnedConnectionFields(connection(), {
      chat: { id: 4242, type: 'private' },
    })
    expect(patch.dmChatId).toBe('4242')
  })

  test('stays quiet when nothing new was learned', () => {
    const patch = learnedConnectionFields(connection({ dmChatId: '4242' }), {
      chat: { id: 4242, type: 'private' },
    })
    expect(patch).toEqual({})
  })

  // Only the private chat is addressed, so a group must not be
  // mistaken for the DM.
  test('ignores group and channel chats', () => {
    const patch = learnedConnectionFields(connection(), {
      chat: { id: -100123, type: 'supergroup' },
    })
    expect(patch.dmChatId).toBeUndefined()
  })

  test('infers topic support from a message that carries a thread id', () => {
    const patch = learnedConnectionFields(connection(), {
      chat: { id: 1, type: 'private' },
      message_thread_id: 9,
    })
    expect(patch.topicsEnabled).toBe(true)
  })

  test('accepts the declared capability on the sender', () => {
    const patch = learnedConnectionFields(connection(), {
      chat: { id: 1, type: 'private' },
      from: { id: 1, has_topics_enabled: true },
    })
    expect(patch.topicsEnabled).toBe(true)
  })

  test('does not turn topics on from an ordinary message', () => {
    const patch = learnedConnectionFields(connection(), {
      chat: { id: 1, type: 'private' },
      from: { id: 1 },
    })
    expect(patch.topicsEnabled).toBeUndefined()
  })

  test('never flips topics back off once seen', () => {
    const patch = learnedConnectionFields(
      connection({ dmChatId: '1', topicsEnabled: true }),
      { chat: { id: 1, type: 'private' } },
    )
    expect(patch).toEqual({})
  })
})
