import { describe, expect, test } from 'bun:test'
import { decide, escalate } from '@bun/modules/conversation/permissions'
import type { RecordTarget } from '@bun/modules/conversation/records'
import type { Db } from '@bun/modules/db/db'
import type { DraftRecord, TranscriptRecord } from '@bun/shared/transcript'
import type { AcpPermissionRequest } from 'acpx-ai-provider'

const AGENT = 'scout'
const REQUEST = 'call_1'

/** Enough of a request for the two fields escalate reads. */
function request(...optionIds: string[]): AcpPermissionRequest {
  return {
    inferredKind: 'write',
    raw: {
      toolCall: { toolCallId: REQUEST, title: 'Write a file' },
      options: optionIds.map((optionId) => ({
        optionId,
        name: optionId,
        kind: 'allow_once',
      })),
    },
  } as unknown as AcpPermissionRequest
}

function harness() {
  const written: DraftRecord[] = []
  let n = 0
  const append = (draft: DraftRecord): TranscriptRecord => {
    written.push(draft)
    n += 1
    return {
      ...draft,
      seq: n,
      id: `r_${n}`,
      at: 'now',
      turn: 't_1',
    } as TranscriptRecord
  }
  // A decision reaches the transcript through the same target, so the stub
  // records what it was handed rather than refusing to be called.
  const decisions: DraftRecord[] = []
  const target = {
    agentId: AGENT,
    turn: 't_1',
    transcript: {
      append: (_turn: string, draft: DraftRecord) => {
        decisions.push(draft)
        return append(draft)
      },
    },
  } as unknown as RecordTarget
  const db = {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({ run: () => undefined }),
        run: () => undefined,
      }),
    }),
  } as unknown as Db
  return { append, written, db, target, decisions }
}

describe('answering a permission request', () => {
  test('counts as a reported block, through the session writer', () => {
    const { append, written } = harness()
    void escalate(
      AGENT,
      append,
      request('allow', 'deny'),
      new AbortController().signal,
    )

    // Written through the callback the session owns rather than straight to
    // the transcript, which is what makes it count towards the turn.
    expect(written).toHaveLength(1)
    expect(written[0]?.kind).toBe('permission')
  })

  test('refuses an option the agent never offered', () => {
    const { append, db, target } = harness()
    void escalate(
      AGENT,
      append,
      request('allow', 'deny'),
      new AbortController().signal,
    )

    expect(decide(db, target, REQUEST, 'r_1', 'allow_always')).toBe(false)
  })

  test('refuses a decision filed against another record', () => {
    const { append, db, target } = harness()
    void escalate(
      AGENT,
      append,
      request('allow', 'deny'),
      new AbortController().signal,
    )

    expect(decide(db, target, REQUEST, 'r_99', 'allow')).toBe(false)
  })

  test('refuses a request nothing is waiting on', () => {
    const { db, target } = harness()
    expect(decide(db, target, 'call_never', 'r_1', 'allow')).toBe(false)
  })

  test('accepts an offered option and hands it to the waiting agent', async () => {
    const { append, db, target, decisions } = harness()
    const waiting = escalate(
      AGENT,
      append,
      request('allow', 'deny'),
      new AbortController().signal,
    )

    expect(decide(db, target, REQUEST, 'r_1', 'allow')).toBe(true)
    await expect(waiting).resolves.toEqual({
      outcome: 'selected',
      optionId: 'allow',
    })
    expect(decisions.at(-1)).toMatchObject({ kind: 'decision', ref: 'r_1' })
  })

  test('forgets the offer once it is answered, so a second click is refused', async () => {
    const { append, db, target } = harness()
    const waiting = escalate(
      AGENT,
      append,
      request('allow', 'deny'),
      new AbortController().signal,
    )

    expect(decide(db, target, REQUEST, 'r_1', 'allow')).toBe(true)
    await waiting
    expect(decide(db, target, REQUEST, 'r_1', 'allow')).toBe(false)
  })
})
