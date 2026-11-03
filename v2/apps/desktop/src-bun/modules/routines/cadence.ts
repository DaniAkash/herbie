/**
 * Plain language to cron.
 *
 * A grammar rather than a model call, for two reasons. It has to answer while
 * someone is typing, and it has to give the same answer every time: a routine
 * whose meaning drifts between saves is worse than one that admits it does
 * not understand.
 *
 * Anything outside the grammar returns null. Guessing at a cadence would mean
 * silently running work at the wrong time, which is the one failure nobody
 * notices until it matters.
 */

export interface Cadence {
  /** Standard five field cron: minute hour day-of-month month day-of-week. */
  readonly cron: string
  /** How the parse reads back, so the person can check it meant what they said. */
  readonly reading: string
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
}

const DAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

interface Time {
  readonly hour: number
  readonly minute: number
}

function clock(time: Time): string {
  const h = time.hour % 12 === 0 ? 12 : time.hour % 12
  const suffix = time.hour < 12 ? 'am' : 'pm'
  return time.minute === 0
    ? `${h}${suffix}`
    : `${h}:${String(time.minute).padStart(2, '0')}${suffix}`
}

function hourOf(token: string): number | null {
  const word = WORD_NUMBERS[token]
  if (word !== undefined) return word
  if (/^\d{1,2}$/.test(token)) {
    const n = Number(token)
    return n >= 0 && n <= 23 ? n : null
  }
  return null
}

/** noon, midday, midnight. */
function namedTime(text: string): Time | null {
  if (text === 'noon' || text === 'midday') return { hour: 12, minute: 0 }
  if (text === 'midnight') return { hour: 0, minute: 0 }
  return null
}

/** half past seven, quarter past six, quarter to eight. */
function offsetTime(text: string): Time | null {
  const offsets: ReadonlyArray<readonly [RegExp, number, number]> = [
    [/^half past (.+)$/, 30, 0],
    [/^quarter past (.+)$/, 15, 0],
    // Quarter to eight is seven forty five, so the hour steps back with it.
    [/^quarter to (.+)$/, 45, -1],
  ]
  for (const [pattern, minute, hourShift] of offsets) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const base = parseTime(match[1])
    if (!base) return null
    return { hour: (base.hour + hourShift + 24) % 24, minute }
  }
  return null
}

/** 7, 7am, 7pm, 7:30, 7:30pm, 19:00. */
function clockTime(text: string): Time | null {
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match?.[1]) return null

  let hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  const meridiem = match[3]
  if (minute > 59) return null
  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0
  return hour > 23 ? null : { hour, minute }
}

/** seven, seven thirty, seven fifteen. */
function wordTime(text: string): Time | null {
  const words = text.split(/\s+/)
  const hour = words[0] ? hourOf(words[0]) : null
  if (hour === null) return null
  if (words.length === 1) return { hour, minute: 0 }
  if (words[1] === 'thirty') return { hour, minute: 30 }
  if (words[1] === 'fifteen') return { hour, minute: 15 }
  return null
}

/**
 * Reads a time of day.
 *
 * An unqualified hour is taken as morning, which is what people mean when
 * they say seven without saying which seven. The one exception is twelve,
 * which is noon rather than midnight for the same reason.
 */
export function parseTime(input: string): Time | null {
  const text = input.trim().toLowerCase()
  if (!text) return null
  return (
    namedTime(text) ?? offsetTime(text) ?? clockTime(text) ?? wordTime(text)
  )
}

function schedule(time: Time, dow: string, reading: string): Cadence {
  return { cron: `${time.minute} ${time.hour} * * ${dow}`, reading }
}

/** every hour, hourly, every three hours. */
function repeating(text: string): Cadence | null {
  if (text === 'every hour' || text === 'hourly') {
    return { cron: '0 * * * *', reading: 'every hour, on the hour' }
  }
  const match = text.match(/^every (\w+) hours?$/)
  if (!match?.[1]) return null
  const n = hourOf(match[1])
  if (n === null || n < 1 || n > 23) return null
  return {
    cron: `0 */${n} * * *`,
    reading: n === 1 ? 'every hour, on the hour' : `every ${n} hours`,
  }
}

/** The days a scope covers, as a cron day-of-week field and words. */
function daysOf(scope: string): { dow: string; words: string } | null {
  if (scope === 'day') return { dow: '*', words: 'every day' }
  if (scope === 'weekday') return { dow: '1-5', words: 'Monday to Friday' }
  if (scope === 'weekend' || scope === 'weekends') {
    return { dow: '0,6', words: 'Saturday and Sunday' }
  }
  const day = DAYS[scope]
  if (day === undefined) return null
  return { dow: String(day), words: `every ${DAY_NAMES[day]}` }
}

/**
 * Turns a cadence into cron, or returns null when it cannot.
 *
 * Null is a real answer here and is shown to the person as one. The
 * alternative, picking the nearest thing the grammar does understand, would
 * mean work running at a time nobody asked for.
 */
export function toCron(input: string): Cadence | null {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/[.,!]+$/, '')
  if (!text) return null

  const repeats = repeating(text)
  if (repeats) return repeats

  const at = text.match(
    /^(?:every (day|weekday|weekends?|[a-z]+day)s?|([a-z]+day)s)?\s*(?:at\s+)?(.+?)$/,
  )
  if (!at) return null

  const days = daysOf(at[1] ?? at[2] ?? 'day')
  const time = parseTime(at[3] ?? '')
  if (!days || !time) return null
  return schedule(time, days.dow, `${days.words} at ${clock(time)}`)
}
