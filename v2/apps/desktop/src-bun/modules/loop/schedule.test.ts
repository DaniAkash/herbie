import { describe, expect, test } from 'bun:test'
import {
  type DueRoutine,
  isQuiet,
  matches,
  parseQuietHours,
  slotOf,
  verdictFor,
} from '@bun/modules/loop/schedule'
import { toCron } from '@bun/modules/routines/cadence'

/** A local instant, so the assertions read as the wall clock the person sees. */
function at(y: number, m: number, d: number, h: number, min: number): number {
  return new Date(y, m - 1, d, h, min, 0, 0).getTime()
}

const routine = (over: Partial<DueRoutine> = {}): DueRoutine => ({
  id: 'r1',
  agentId: 'scout',
  cron: '0 9 * * 1-5',
  enabled: true,
  kind: 'schedule',
  ...over,
})

describe('matching a cron minute', () => {
  // 2026-11-04 is a Wednesday.
  test('matches an exact minute and hour', () => {
    expect(matches('0 9 * * *', at(2026, 11, 4, 9, 0))).toBe(true)
    expect(matches('0 9 * * *', at(2026, 11, 4, 9, 1))).toBe(false)
    expect(matches('0 9 * * *', at(2026, 11, 4, 8, 0))).toBe(false)
  })

  test('matches a weekday range', () => {
    expect(matches('0 9 * * 1-5', at(2026, 11, 4, 9, 0))).toBe(true)
    // Sunday the 8th is outside 1-5.
    expect(matches('0 9 * * 1-5', at(2026, 11, 8, 9, 0))).toBe(false)
  })

  test('matches a comma list and a step', () => {
    expect(matches('0 9,17 * * *', at(2026, 11, 4, 17, 0))).toBe(true)
    expect(matches('0 9,17 * * *', at(2026, 11, 4, 13, 0))).toBe(false)
    expect(matches('*/15 * * * *', at(2026, 11, 4, 13, 30))).toBe(true)
    expect(matches('*/15 * * * *', at(2026, 11, 4, 13, 31))).toBe(false)
  })

  test('refuses an expression it does not understand', () => {
    // Not a guess at what the person meant. A routine that runs at the wrong
    // time is worse than one that visibly never runs.
    expect(matches('0 9 * *', at(2026, 11, 4, 9, 0))).toBe(false)
    expect(matches('every morning', at(2026, 11, 4, 9, 0))).toBe(false)
    expect(matches('0 9 * * MON', at(2026, 11, 4, 9, 0))).toBe(false)
  })
})

describe('quiet hours', () => {
  const night = parseQuietHours('23:00-07:00')

  test('spans midnight', () => {
    expect(isQuiet(night, at(2026, 11, 4, 23, 30))).toBe(true)
    expect(isQuiet(night, at(2026, 11, 4, 2, 0))).toBe(true)
    expect(isQuiet(night, at(2026, 11, 4, 6, 59))).toBe(true)
    expect(isQuiet(night, at(2026, 11, 4, 7, 0))).toBe(false)
    expect(isQuiet(night, at(2026, 11, 4, 12, 0))).toBe(false)
  })

  test('handles a window inside one day', () => {
    const lunch = parseQuietHours('12:00-13:00')
    expect(isQuiet(lunch, at(2026, 11, 4, 12, 30))).toBe(true)
    expect(isQuiet(lunch, at(2026, 11, 4, 13, 0))).toBe(false)
  })

  test('nothing is quiet when it is not set', () => {
    expect(isQuiet(null, at(2026, 11, 4, 3, 0))).toBe(false)
    expect(parseQuietHours(null)).toBeNull()
    expect(parseQuietHours('garbage')).toBeNull()
    expect(parseQuietHours('23:00-23:00')).toBeNull()
  })
})

describe('what should happen to a routine', () => {
  const night = parseQuietHours('23:00-07:00')

  test('due on its slot', () => {
    expect(verdictFor(routine(), at(2026, 11, 4, 9, 0), night)).toBe('due')
  })

  test('not due on any other minute', () => {
    expect(verdictFor(routine(), at(2026, 11, 4, 9, 1), night)).toBe('not-due')
  })

  test('quiet rather than due inside the window', () => {
    const nightly = routine({ cron: '0 2 * * *' })
    expect(verdictFor(nightly, at(2026, 11, 4, 2, 0), night)).toBe('quiet')
    // Separate from not-due, because a skip for the person's sake is worth
    // recording and a minute that was not its slot is not.
    expect(verdictFor(nightly, at(2026, 11, 4, 2, 0), null)).toBe('due')
  })

  test('a disabled routine never fires', () => {
    expect(
      verdictFor(routine({ enabled: false }), at(2026, 11, 4, 9, 0), night),
    ).toBe('not-due')
  })

  test('an event routine is not on a clock', () => {
    expect(
      verdictFor(
        routine({ kind: 'event', cron: null }),
        at(2026, 11, 4, 9, 0),
        night,
      ),
    ).toBe('not-due')
  })

  test('a schedule whose cadence never parsed never fires', () => {
    expect(
      verdictFor(routine({ cron: null }), at(2026, 11, 4, 9, 0), night),
    ).toBe('not-due')
  })
})

describe('the slot', () => {
  test('is the minute, so a second scan of it is the same slot', () => {
    const a = slotOf(at(2026, 11, 4, 9, 0) + 12_000)
    const b = slotOf(at(2026, 11, 4, 9, 0) + 47_000)
    expect(a).toBe(b)
  })
})

describe('the grammar and the matcher agree', () => {
  // The one seam where a routine can be stored and never fire: the grammar
  // writes a cron the matcher does not read. Pinned rather than assumed.
  const phrases = [
    'every weekday at 9',
    'every day at 2',
    'every monday at 10',
    'every hour',
    'fridays at 5pm',
    'every sunday at 8',
    'every 2 hours',
    'at midnight',
  ]

  test('every cadence the grammar parses fires at least once in a week', () => {
    for (const phrase of phrases) {
      const cadence = toCron(phrase)
      expect(cadence).not.toBeNull()
      if (!cadence) continue

      let fired = 0
      const start = at(2026, 11, 2, 0, 0) // a Monday
      for (let minute = 0; minute < 7 * 24 * 60; minute += 1) {
        if (matches(cadence.cron, start + minute * 60_000)) fired += 1
      }
      expect({ phrase, fired: fired > 0 }).toEqual({ phrase, fired: true })
    }
  })

  test('a weekday cadence fires five times a week, not seven', () => {
    const cadence = toCron('every weekday at 9')
    const start = at(2026, 11, 2, 0, 0)
    let fired = 0
    for (let minute = 0; minute < 7 * 24 * 60; minute += 1) {
      if (cadence && matches(cadence.cron, start + minute * 60_000)) fired += 1
    }
    expect(fired).toBe(5)
  })
})
