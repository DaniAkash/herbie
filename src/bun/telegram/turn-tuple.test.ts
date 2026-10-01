import { describe, expect, test } from 'bun:test'
import type { Conversation } from '../../db/schema/conversations.sql'
import { providerKeyEqual } from '../chat/tuple'
import { conversationTurnTuple } from './turn-tuple'

function conversation(over: Partial<Conversation> = {}): Conversation {
  const now = new Date()
  return {
    id: 'conv-1',
    title: 'codex silent failure',
    agentId: 'claude',
    modelId: 'sonnet',
    workspacePath: '/w/herbie',
    reasoningEffort: 'high',
    permissionMode: null,
    acpxSessionId: null,
    acpxRecordId: null,
    agentSessionId: null,
    status: 'idle',
    origin: 'chat',
    archivedAt: null,
    lastSeenAt: null,
    pinnedAt: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  } as Conversation
}

describe('conversationTurnTuple', () => {
  test('takes every field from the conversation', () => {
    expect(conversationTurnTuple(conversation())).toEqual({
      agentId: 'claude',
      modelId: 'sonnet',
      workspacePath: '/w/herbie',
      reasoningEffort: 'high',
    })
  })

  test('carries nulls through rather than substituting defaults', () => {
    const tuple = conversationTurnTuple(
      conversation({
        modelId: null,
        workspacePath: null,
        reasoningEffort: null,
      }),
    )
    expect(tuple.modelId).toBeNull()
    expect(tuple.workspacePath).toBeNull()
    expect(tuple.reasoningEffort).toBeNull()
  })

  // The regression this function exists to prevent. A turn that runs
  // under a bot's agent or workspace instead of the conversation's
  // fails providerKeyEqual, which closes the open provider and replays
  // the transcript into a different agent in a different directory.
  test('stays on the same provider as the conversation it belongs to', () => {
    const conv = conversation({ agentId: 'claude', workspacePath: '/w/herbie' })
    const botTuple = {
      agentId: 'codex',
      modelId: null,
      workspacePath: '/w/other',
      reasoningEffort: null,
    }

    expect(providerKeyEqual(conversationTurnTuple(conv), conv)).toBe(true)
    expect(providerKeyEqual(botTuple, conv)).toBe(false)
  })
})
