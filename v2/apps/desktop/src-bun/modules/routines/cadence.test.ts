import { describe, expect, test } from 'bun:test'
import { toCron } from '@bun/modules/routines/cadence'

const cron = (text: string) => toCron(text)?.cron ?? null

describe('cadences the grammar understands', () => {
  test.each([
    ['every weekday at seven', '0 7 * * 1-5'],
    ['Every weekday at 7am', '0 7 * * 1-5'],
    ['every day at eight', '0 8 * * *'],
    ['every day at 8:30', '30 8 * * *'],
    ['at seven', '0 7 * * *'],
    ['every weekend at ten', '0 10 * * 0,6'],
    ['every monday at nine', '0 9 * * 1'],
    ['Sundays at six', '0 6 * * 0'],
    ['every hour', '0 * * * *'],
    ['every three hours', '0 */3 * * *'],
    ['every day at half past seven', '30 7 * * *'],
    ['every day at quarter past six', '15 6 * * *'],
    ['every day at 19:00', '0 19 * * *'],
    ['every day at 7pm', '0 19 * * *'],
    ['every day at noon', '0 12 * * *'],
    ['every day at midnight', '0 0 * * *'],
    ['every day at seven thirty', '30 7 * * *'],
  ])('%s is %s', (text, expected) => {
    expect(cron(text)).toBe(expected)
  })

  test('it reads back in words, so the parse can be checked', () => {
    expect(toCron('every weekday at seven')?.reading).toBe(
      'Monday to Friday at 7am',
    )
    expect(toCron('every day at 19:00')?.reading).toBe('every day at 7pm')
  })
})

describe('cadences it refuses', () => {
  // Each of these is a thing cron cannot say. Picking the nearest expression
  // the grammar does understand would silently drop the part that was the
  // whole point of the sentence.
  test.each([
    ['every three hours until eight'],
    ['whenever I feel like it'],
    ['twice a month'],
    ['on the first of every month'],
    ['every day at 25'],
    ['every day at 7:70'],
    ['every 40 hours'],
    ['every five hours'],
    ['every seven hours'],
    [''],
    ['   '],
  ])('%s does not parse', (text) => {
    expect(toCron(text)).toBeNull()
  })
})
