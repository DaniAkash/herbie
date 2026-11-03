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
  if (text === 'noon' || text === 'midday') return { hour: 12, minute: 0 }
  if (text === 'midnight') return { hour: 0, minute: 0 }

  const half = text.match(/^half past (.+)$/)
  if (half?.[1]) {
    const base = parseTime(half[1])
    return base ? { hour: base.hour, minute: 30 } : null
  }
  const quarterPast = text.match(/^quarter past (.+)$/)
  if (quarterPast?.[1]) {
    const base = parseTime(quarterPast[1])
    return base ? { hour: base.hour, minute: 15 } : null
  }
  const quarterTo = text.match(/^quarter to (.+)$/)
  if (quarterTo?.[1]) {
    const base = parseTime(quarterTo[1])
    return base ? { hour: (base.hour + 23) % 24, minute: 45 } : null
  }

  // 7, 7am, 7pm, 7:30, 7:30pm, 19:00
  const clockMatch = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (clockMatch?.[1]) {
    let hour = Number(clockMatch[1])
    const minute = Number(clockMatch[2] ?? 0)
    const meridiem = clockMatch[3]
    if (minute > 59) return null
    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
    if (hour > 23) return null
    // A bare 7 means the morning; a bare 19 is already unambiguous.
    return { hour, minute }
  }

  // seven, seven thirty
  const words = text.split(/\s+/)
  const hour = words[0] ? hourOf(words[0]) : null
  if (hour === null) return null
  if (words.length === 1) return { hour, minute: 0 }
  if (words[1] === 'thirty') return { hour, minute: 30 }
  if (words[1] === 'fifteen') return { hour, minute: 15 }
  return null
}

function schedule(time: Time, dow: string, reading: string): Cadence {
  return { cron: `${time.minute} ${time.hour} * * ${dow}`, reading }
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

  if (text === 'every hour' || text === 'hourly') {
    return { cron: '0 * * * *', reading: 'every hour, on the hour' }
  }

  const everyN = text.match(/^every (\w+) hours?$/)
  if (everyN?.[1]) {
    const n = hourOf(everyN[1])
    if (n === null || n < 1 || n > 23) return null
    return {
      cron: `0 */${n} * * *`,
      reading: n === 1 ? 'every hour, on the hour' : `every ${n} hours`,
    }
  }

  const at = text.match(
    /^(?:every (day|weekday|weekends?|[a-z]+day)s?|([a-z]+day)s)?\s*(?:at\s+)?(.+?)$/,
  )
  if (!at) return null

  const scope = at[1] ?? at[2] ?? 'day'
  const time = parseTime(at[3] ?? '')
  if (!time) return null

  if (scope === 'day') {
    return schedule(time, '*', `every day at ${clock(time)}`)
  }
  if (scope === 'weekday') {
    return schedule(time, '1-5', `Monday to Friday at ${clock(time)}`)
  }
  if (scope === 'weekend' || scope === 'weekends') {
    return schedule(time, '0,6', `Saturday and Sunday at ${clock(time)}`)
  }
  const day = DAYS[scope]
  if (day === undefined) return null
  return schedule(
    time,
    String(day),
    `every ${DAY_NAMES[day]} at ${clock(time)}`,
  )
}
