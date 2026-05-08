const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function relativeTime(ts: number, ref: number = Date.now()): string {
  const delta = ref - ts
  if (delta < MINUTE) return 'just now'
  if (delta < HOUR) {
    const m = Math.floor(delta / MINUTE)
    return `${m}m ago`
  }
  if (delta < DAY) {
    const h = Math.floor(delta / HOUR)
    return `${h}h ago`
  }
  if (delta < 7 * DAY) {
    const d = Math.floor(delta / DAY)
    return d === 1 ? 'yesterday' : `${d}d ago`
  }
  const date = new Date(ts)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function clockTime(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function dayBucket(ts: number, ref: number = Date.now()): string {
  const refDate = new Date(ref)
  const refStart = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate(),
  ).getTime()
  const tsDate = new Date(ts)
  const tsStart = new Date(
    tsDate.getFullYear(),
    tsDate.getMonth(),
    tsDate.getDate(),
  ).getTime()
  const days = Math.floor((refStart - tsStart) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Earlier this week'
  if (days < 30) return 'Earlier this month'
  return 'Older'
}
