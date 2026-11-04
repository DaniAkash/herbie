/**
 * Which routines are due, and when a routine must not run at all.
 *
 * Cron is matched rather than parsed into a next-fire time, because the
 * question the loop asks is "is this slot mine", not "when is the next one".
 * Matching makes the scan idempotent: the same minute checked twice gives
 * the same answer, and the unique index on the run row does the rest.
 */

export interface QuietHours {
  /** Minutes from midnight, local time. */
  readonly from: number
  readonly to: number
}

export interface DueRoutine {
  readonly id: string
  readonly agentId: string
  readonly cron: string | null
  readonly enabled: boolean
  readonly kind: string
}

/** The slot an instant belongs to, to the minute, as the run row stores it. */
export function slotOf(at: number): string {
  const when = new Date(at)
  when.setSeconds(0, 0)
  return when.toISOString()
}

/**
 * Whether a five field cron expression matches this minute.
 *
 * Supports `*`, a number, a comma list, a `a-b` range and a `/n` step, which
 * is everything the cadence grammar can produce. Anything else is treated as
 * no match rather than guessed at: a routine that silently runs at the wrong
 * time is worse than one that visibly never runs.
 */
export function matches(cron: string, at: number): boolean {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) return false

  const when = new Date(at)
  const values = [
    when.getMinutes(),
    when.getHours(),
    when.getDate(),
    when.getMonth() + 1,
    when.getDay(),
  ]

  return fields.every((field, at2) => {
    const value = values[at2]
    return value !== undefined && fieldMatches(field, value)
  })
}

function fieldMatches(field: string, value: number): boolean {
  return field.split(',').some((part) => partMatches(part, value))
}

function partMatches(part: string, value: number): boolean {
  const [range, step] = part.split('/')
  if (range === undefined) return false

  const by = step === undefined ? 1 : Number(step)
  if (!Number.isInteger(by) || by < 1) return false

  if (range === '*') return value % by === 0

  const [lo, hi] = range.split('-')
  const from = Number(lo)
  if (!Number.isInteger(from)) return false

  if (hi === undefined)
    return by === 1 ? value === from : value % by === from % by
  const to = Number(hi)
  if (!Number.isInteger(to)) return false

  return value >= from && value <= to && (value - from) % by === 0
}

/**
 * Whether an instant falls inside the quiet window.
 *
 * Handles a window that crosses midnight, which is the usual case: eleven at
 * night to seven in the morning is two spans, not one.
 */
export function isQuiet(quiet: QuietHours | null, at: number): boolean {
  if (!quiet) return false
  const when = new Date(at)
  const minute = when.getHours() * 60 + when.getMinutes()
  return quiet.from <= quiet.to
    ? minute >= quiet.from && minute < quiet.to
    : minute >= quiet.from || minute < quiet.to
}

/** "23:00" to minutes from midnight, or null when it is not a time. */
export function parseTime(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function parseQuietHours(raw: string | null): QuietHours | null {
  if (!raw) return null
  const [from, to] = raw.split('-')
  if (from === undefined || to === undefined) return null
  const start = parseTime(from)
  const end = parseTime(to)
  if (start === null || end === null || start === end) return null
  return { from: start, to: end }
}

export type Verdict = 'due' | 'quiet' | 'not-due'

/**
 * What should happen to one routine at one instant.
 *
 * Quiet hours produce `quiet` rather than `not-due`, because the two want
 * different records: a routine that was skipped for the person's sake is
 * worth saying out loud, and a minute that simply was not its slot is not.
 */
export function verdictFor(
  routine: DueRoutine,
  at: number,
  quiet: QuietHours | null,
): Verdict {
  if (!routine.enabled) return 'not-due'
  // Only schedules fire on a clock. An event routine has no cron and is
  // waiting on something this loop does not yet produce.
  if (routine.kind !== 'schedule') return 'not-due'
  if (!routine.cron || !matches(routine.cron, at)) return 'not-due'
  return isQuiet(quiet, at) ? 'quiet' : 'due'
}
