import { describe, expect, test } from 'bun:test'
import type { TranscriptRecord } from '@bun/shared/transcript'
import {
  EMPTY,
  type ThreadAction,
  type ThreadState,
  threadReducer,
} from '@/screens/conversation/conversation.reducer'

let next = 0
function record(
  draft: Omit<TranscriptRecord, 'seq' | 'id' | 'at' | 'turn'> & {
    id?: string
    seq?: number
  },
): TranscriptRecord {
  next += 1
  return {
    seq: draft.seq ?? next,
    id: draft.id ?? `r_${next}`,
    at: new Date(1_762_000_000_000 + next * 1000).toISOString(),
    turn: 't_1',
    ...draft,
  } as TranscriptRecord
}

function fold(actions: ThreadAction[], from: ThreadState = EMPTY): ThreadState {
  return actions.reduce(threadReducer, from)
}

function records(...drafts: Parameters<typeof record>[0][]): ThreadAction[] {
  return drafts.map((draft) => ({
    type: 'record' as const,
    record: record(draft),
  }))
}

describe('what the thread renders', () => {
  test('keeps blocks in order and drops the lifecycle', () => {
    const state = fold(
      records(
        { kind: 'user', text: 'draft today posts' },
        { kind: 'turn.start' },
        { kind: 'activity', text: 'Reading the feed', phase: 'working' },
        { kind: 'say', text: 'Five drafts.' },
        { kind: 'turn.end', reason: 'stop' },
      ),
    )
    expect(state.records.map((r) => r.kind)).toEqual(['user', 'say'])
    expect(state.phase).toBe('idle')
  })

  test('refuses a record it has already seen', () => {
    // The stream replays from a cursor and then goes live, and on a reconnect
    // the two can overlap by a record. The sequence number is the dedupe.
    const first = record({ kind: 'say', text: 'once', seq: 5 })
    const state = fold([
      { type: 'record', record: first },
      { type: 'record', record: first },
    ])
    expect(state.records).toHaveLength(1)
    expect(state.lastSeq).toBe(5)
  })
})

describe('the live indicator', () => {
  test('starts thinking, moves to working, then stops', () => {
    const started = fold(records({ kind: 'turn.start' }))
    expect(started.phase).toBe('thinking')
    expect(started.startedAt).toBeGreaterThan(0)

    const working = fold(
      records({ kind: 'activity', text: 'Drafting', phase: 'working' }),
      started,
    )
    expect(working.phase).toBe('working')
    expect(working.activity).toBe('Drafting')

    const done = fold(records({ kind: 'turn.end', reason: 'stop' }), working)
    expect(done.phase).toBe('idle')
    expect(done.startedAt).toBeNull()
  })

  test('learns a turn is running from the stream, not just the records', () => {
    // A reconnect past the turn.start record has no other way to know.
    const state = fold([
      {
        type: 'turn',
        live: {
          turnId: 't_9',
          phase: 'working',
          activity: 'Reading the feed',
          startedAt: 1_762_000_000_000,
        },
      },
    ])
    expect(state.phase).toBe('working')
    expect(state.activity).toBe('Reading the feed')
    expect(state.startedAt).toBe(1_762_000_000_000)
  })

  test('waits rather than working while a question is unanswered', () => {
    const asked = fold(
      records(
        { kind: 'turn.start' },
        {
          kind: 'ask',
          id: 'r_ask',
          questions: [{ q: 'Post it?', type: 'radio', options: ['Yes', 'No'] }],
          answers: null,
        },
      ),
    )
    expect(asked.phase).toBe('waiting')
    expect(asked.pending).toEqual(['r_ask'])

    // An activity update arriving while it waits must not undo the wait.
    const nudged = fold(
      records({ kind: 'activity', text: 'Thinking', phase: 'working' }),
      asked,
    )
    expect(nudged.phase).toBe('waiting')
  })
})

describe('folding an answer back on', () => {
  test('files the answers against the question and stops waiting', () => {
    const asked = fold(
      records(
        { kind: 'turn.start' },
        {
          kind: 'ask',
          id: 'r_ask',
          questions: [{ q: 'Post it?', type: 'radio', options: ['Yes', 'No'] }],
          answers: null,
        },
      ),
    )
    const answered = fold(
      records({ kind: 'answer', ref: 'r_ask', answers: { '0': [1] } }),
      asked,
    )
    expect(answered.answers.r_ask).toEqual({ '0': [1] })
    expect(answered.pending).toEqual([])
    // The agent is unblocked, so the indicator goes back to working.
    expect(answered.phase).toBe('working')
    // The thread is append-only: the answer is not a block of its own.
    expect(answered.records.map((r) => r.kind)).toEqual(['ask'])
  })

  test('files a decision against the permission it settles', () => {
    const asked = fold(
      records({
        kind: 'permission',
        id: 'r_perm',
        requestId: 'call_1',
        toolName: 'Write a file',
        detail: 'edit',
        options: [{ optionId: 'allow', name: 'Allow', kind: 'allow_once' }],
        decision: null,
      }),
    )
    expect(asked.phase).toBe('waiting')

    const decided = fold(
      records({ kind: 'decision', ref: 'r_perm', optionId: 'allow' }),
      asked,
    )
    expect(decided.decisions.r_perm).toBe('allow')
    expect(decided.pending).toEqual([])
  })
})

describe('an error', () => {
  test('renders as a block and is remembered', () => {
    const state = fold(records({ kind: 'error', text: 'the agent went away' }))
    expect(state.records.map((r) => r.kind)).toEqual(['error'])
    expect(state.error).toBe('the agent went away')
  })

  test('is cleared by the next turn starting', () => {
    const failed = fold(records({ kind: 'error', text: 'went away' }))
    expect(fold(records({ kind: 'turn.start' }), failed).error).toBeNull()
  })
})

describe('switching agents', () => {
  test('resets to nothing rather than showing the last one briefly', () => {
    const state = fold(records({ kind: 'say', text: 'theirs' }))
    expect(threadReducer(state, { type: 'reset' })).toEqual(EMPTY)
  })
})
