import { describe, expect, test } from 'bun:test'
import { parkEvent, read } from '@bun/modules/notifications/state'
import type { TranscriptRecord } from '@bun/shared/transcript'

const base = { seq: 1, id: 'r1', at: '2026-11-14T10:00:00Z', turn: 't1' }

function readRecord(
  record: TranscriptRecord,
  startedAt: number | null = null,
  at = 0,
) {
  return read(
    record,
    'scout',
    startedAt === null ? null : { turnId: 't1', startedAt },
    at,
  )
}

describe('the two moments that are not turn ends', () => {
  test('a permission prompt with no decision is the agent frozen', () => {
    const reading = readRecord({
      ...base,
      kind: 'permission',
      requestId: 'p1',
      toolName: 'Bash',
      detail: 'bun run check',
      options: [],
      decision: null,
    })
    expect(reading.becomes).toBe('awaiting')
    expect(reading.event?.kind).toBe('needs_you')
    expect(
      reading.event?.kind === 'needs_you' ? reading.event.reason : null,
    ).toBe('permission')
  })

  test('an answered permission is not the agent waiting', () => {
    const reading = readRecord({
      ...base,
      kind: 'permission',
      requestId: 'p1',
      toolName: 'Bash',
      detail: '',
      options: [],
      decision: 'allow',
    })
    expect(reading.becomes).toBe('working')
    expect(reading.event).toBe(null)
  })

  test('an unanswered ask is the agent frozen', () => {
    const reading = readRecord({
      ...base,
      kind: 'ask',
      questions: [{ q: 'Which one?', type: 'radio', options: ['a', 'b'] }],
      answers: null,
    })
    expect(reading.becomes).toBe('awaiting')
    expect(
      reading.event?.kind === 'needs_you' ? reading.event.reason : null,
    ).toBe('question')
  })

  test('an answered ask is not', () => {
    const reading = readRecord({
      ...base,
      kind: 'ask',
      questions: [{ q: 'Which one?', type: 'radio', options: ['a'] }],
      answers: { '0': [0] },
    })
    expect(reading.becomes).toBe('working')
    expect(reading.event).toBe(null)
  })
})

describe('answering a hold puts the agent back to work', () => {
  test('a decision record, which is what withdraws a live banner', () => {
    const reading = readRecord({
      ...base,
      kind: 'decision',
      ref: 'r0',
      optionId: 'allow',
    })
    expect(reading.becomes).toBe('working')
    expect(reading.event).toBe(null)
  })

  test('an answer record does the same', () => {
    const reading = readRecord({
      ...base,
      kind: 'answer',
      ref: 'r0',
      answers: { '0': [1] },
    })
    expect(reading.becomes).toBe('working')
    expect(reading.event).toBe(null)
  })
})

describe('the end of a turn', () => {
  test('an error is news', () => {
    const reading = readRecord({ ...base, kind: 'turn.end', reason: 'error' })
    expect(reading.becomes).toBe('failed')
    expect(reading.event?.kind).toBe('turn_failed')
  })

  test('a cancel is the person stopping work, so it is never news', () => {
    const reading = readRecord({ ...base, kind: 'turn.end', reason: 'cancel' })
    expect(reading.becomes).toBe('idle')
    expect(reading.event).toBe(null)
  })

  test('a clean stop carries how long it ran', () => {
    const reading = readRecord(
      { ...base, kind: 'turn.end', reason: 'stop' },
      1_000,
      61_000,
    )
    expect(reading.becomes).toBe('done')
    expect(
      reading.event?.kind === 'turn_done' ? reading.event.ranForMs : null,
    ).toBe(60_000)
  })

  test('a turn whose start was never seen reports no duration rather than a wrong one', () => {
    const reading = readRecord(
      { ...base, kind: 'turn.end', reason: 'stop' },
      null,
      61_000,
    )
    expect(
      reading.event?.kind === 'turn_done' ? reading.event.ranForMs : null,
    ).toBe(0)
  })

  test('a clock belonging to a different turn is not borrowed', () => {
    const reading = read(
      { ...base, turn: 't2', kind: 'turn.end', reason: 'stop' },
      'scout',
      { turnId: 't1', startedAt: 1_000 },
      61_000,
    )
    expect(
      reading.event?.kind === 'turn_done' ? reading.event.ranForMs : null,
    ).toBe(0)
  })
})

describe('records that move nothing worth saying', () => {
  test('a turn starting is work, not news', () => {
    const reading = readRecord({ ...base, kind: 'turn.start' })
    expect(reading.becomes).toBe('working')
    expect(reading.event).toBe(null)
  })

  test('the agent talking is work, not news', () => {
    const reading = readRecord({ ...base, kind: 'say', text: 'On it' })
    expect(reading.becomes).toBe('working')
    expect(reading.event).toBe(null)
  })

  test('activity is work, not news', () => {
    const reading = readRecord({
      ...base,
      kind: 'activity',
      text: 'reading files',
      phase: 'working',
    })
    expect(reading.becomes).toBe('working')
    expect(reading.event).toBe(null)
  })
})

describe('the agent own words, for the body', () => {
  test('a permission carries its detail', () => {
    const reading = readRecord({
      ...base,
      kind: 'permission',
      requestId: 'p1',
      toolName: 'Bash',
      detail: 'bun run check',
      options: [],
      decision: null,
    })
    expect(reading.event?.text).toBe('bun run check')
  })

  test('a permission with no detail falls back to the tool name', () => {
    const reading = readRecord({
      ...base,
      kind: 'permission',
      requestId: 'p1',
      toolName: 'Bash',
      detail: '',
      options: [],
      decision: null,
    })
    expect(reading.event?.text).toBe('Bash')
  })

  test('an ask carries its first question', () => {
    const reading = readRecord({
      ...base,
      kind: 'ask',
      questions: [{ q: 'Remove them?', type: 'radio', options: ['y'] }],
      answers: null,
    })
    expect(reading.event?.text).toBe('Remove them?')
  })
})

describe('the breaker giving up', () => {
  test('is a failure that belongs to the agent, not to a turn', () => {
    const event = parkEvent('scout')
    expect(event.kind).toBe('agent_parked')
    expect(event.becomes).toBe('failed')
    expect(event.turnId).toBe(null)
  })
})
