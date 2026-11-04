import { afterEach, describe, expect, test } from 'bun:test'
import { publish, subscribe, watcherCount } from '@bun/modules/conversation/bus'
import {
  cancelAll,
  hold,
  isPending,
  pendingCount,
  release,
  settle,
} from '@bun/modules/conversation/pending'
import type { TranscriptRecord } from '@bun/shared/transcript'

afterEach(() => {
  cancelAll('postman')
  cancelAll('scout')
})

describe('what is waiting on a person', () => {
  test('settles the thing that was waiting', async () => {
    const waited = new Promise<string>((resolve) => {
      hold<string>('postman', 'r_1', { resolve, onCancel: () => 'cancelled' })
    })
    expect(isPending('postman', 'r_1')).toBe(true)
    expect(settle('postman', 'r_1', 'answered')).toBe(true)
    expect(await waited).toBe('answered')
    expect(isPending('postman', 'r_1')).toBe(false)
  })

  test('refuses a second answer to the same thing', () => {
    hold<string>('postman', 'r_1', { resolve: () => {}, onCancel: () => '' })
    expect(settle('postman', 'r_1', 'first')).toBe(true)
    // The route turns this into a 409. A second submission that quietly
    // resolved nothing would leave the person believing they replied.
    expect(settle('postman', 'r_1', 'second')).toBe(false)
  })

  test('answers nothing when the key is unknown', () => {
    expect(settle('postman', 'never-held', 'x')).toBe(false)
  })

  test('drains everything an agent is waiting on, as a cancellation', async () => {
    const ask = new Promise<string>((resolve) => {
      hold<string>('postman', 'r_1', { resolve, onCancel: () => 'no answer' })
    })
    const permission = new Promise<string>((resolve) => {
      hold<string>('postman', 'call_2', { resolve, onCancel: () => 'denied' })
    })
    hold<string>('scout', 'r_9', { resolve: () => {}, onCancel: () => '' })

    expect(cancelAll('postman').sort()).toEqual(['call_2', 'r_1'])
    expect(await ask).toBe('no answer')
    expect(await permission).toBe('denied')
    // One agent's cancel does not touch another's.
    expect(pendingCount('scout')).toBe(1)
  })

  test('releasing without settling leaves the promise to the abort', () => {
    hold<string>('postman', 'r_1', { resolve: () => {}, onCancel: () => '' })
    release('postman', 'r_1')
    expect(isPending('postman', 'r_1')).toBe(false)
  })
})

describe('the record bus', () => {
  const record = {
    seq: 1,
    id: 'r_1',
    at: 'now',
    turn: 't_1',
    kind: 'say',
    text: 'hi',
  } as TranscriptRecord

  test('delivers to every watcher of that agent and nobody else', () => {
    const mine: TranscriptRecord[] = []
    const theirs: TranscriptRecord[] = []
    const off = subscribe('postman', (s) => {
      if (s.type === 'record') mine.push(s.record)
    })
    subscribe('scout', (s) => {
      if (s.type === 'record') theirs.push(s.record)
    })

    publish('postman', { type: 'record', record })
    expect(mine).toHaveLength(1)
    expect(theirs).toHaveLength(0)

    off()
    publish('postman', { type: 'record', record })
    expect(mine).toHaveLength(1)
    expect(watcherCount('postman')).toBe(0)
  })

  test('a watcher that throws does not stop the next one', () => {
    const seen: string[] = []
    subscribe('postman', () => {
      throw new Error('connection gone')
    })
    subscribe('postman', () => seen.push('second'))
    expect(() => publish('postman', { type: 'record', record })).not.toThrow()
    expect(seen).toEqual(['second'])
  })

  test('publishing to nobody is free', () => {
    expect(() => publish('nobody', { type: 'record', record })).not.toThrow()
  })
})
