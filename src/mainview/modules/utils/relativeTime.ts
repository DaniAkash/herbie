import dayjs from 'dayjs'
import relative from 'dayjs/plugin/relativeTime'

dayjs.extend(relative)

export function relativeTime(ts: number, ref: number = Date.now()): string {
  if (ref - ts < 60_000) return 'just now'
  return dayjs(ts).from(dayjs(ref))
}

// Locale-aware clock format — dayjs's format mask is fixed, so fall through to
// Intl which honors the user's regional 12/24-hour preference.
export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function dayBucket(ts: number, ref: number = Date.now()): string {
  const days = dayjs(ref).startOf('day').diff(dayjs(ts).startOf('day'), 'day')
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Earlier this week'
  if (days < 30) return 'Earlier this month'
  return 'Older'
}
