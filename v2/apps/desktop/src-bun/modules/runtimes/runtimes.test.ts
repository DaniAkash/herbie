import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '@bun/modules/db/db'
import { isFresh, listRuntimes } from '@bun/modules/runtimes/runtimes'

const NOW = Date.parse('2026-11-03T12:00:00.000Z')
const hoursAgo = (n: number) => new Date(NOW - n * 3600_000).toISOString()

describe('trusting a stored probe', () => {
  test('a recent answer from the same version still stands', () => {
    expect(
      isFresh({ probedAt: hoursAgo(2), version: '1.2.3' }, '1.2.3', NOW),
    ).toBe(true)
  })

  test('an answer older than a day is taken again', () => {
    expect(
      isFresh({ probedAt: hoursAgo(25), version: '1.2.3' }, '1.2.3', NOW),
    ).toBe(false)
  })

  test('an upgrade invalidates it however recent it was', () => {
    // An adapter upgrade is exactly when the model list moves, so age alone
    // is not enough to keep believing the cached answer.
    expect(
      isFresh({ probedAt: hoursAgo(1), version: '1.2.3' }, '1.3.0', NOW),
    ).toBe(false)
  })

  test('a runtime that has never been probed is never fresh', () => {
    expect(isFresh(undefined, null, NOW)).toBe(false)
    expect(isFresh({ probedAt: null, version: null }, null, NOW)).toBe(false)
  })
})

describe('the order runtimes are offered in', () => {
  test('what can be used comes before what has to be installed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'herbie-runtimes-'))
    try {
      const { db } = openDb(join(dir, 'herbie.sqlite'))
      const list = await listRuntimes(db)

      const rank = (state: string) =>
        state === 'installed' ? 0 : state === 'npx-available' ? 1 : 2
      const ranks = list.map((r) => rank(r.installState))
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
