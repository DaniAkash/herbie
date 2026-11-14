/**
 * The one line that says why, which the body does not repeat.
 *
 * The body carries the agent's own words wherever the record had any, so the
 * reason has to live somewhere that is always the same length and always
 * true. On the banner this is the subtitle; in the inbox it is the caption.
 */
export function reasonFor(kind: string, reason: string | null): string {
  switch (kind) {
    case 'needs_you':
      return reason === 'question'
        ? 'Asked you a question'
        : 'Needs your go-ahead'
    case 'turn_failed':
      return 'Stopped with an error'
    case 'agent_parked':
      return 'Paused itself'
    case 'turn_done':
      return 'Finished its turn'
    default:
      return 'Has an update'
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Short enough to sit at the end of a row without wrapping it. */
export function agoFrom(iso: string, now: number): string {
  // SQLite writes `current_timestamp` as UTC without a zone, which Date reads
  // as local time and puts hours in the future.
  const at = Date.parse(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`)
  if (Number.isNaN(at)) return ''
  const since = Math.max(0, now - at)
  if (since < MINUTE) return 'now'
  if (since < HOUR) return `${Math.floor(since / MINUTE)}m`
  if (since < DAY) return `${Math.floor(since / HOUR)}h`
  return `${Math.floor(since / DAY)}d`
}
