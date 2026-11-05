import { cn } from '@/lib/utils'

/** Turn time measures elapsed wall time, including tool calls and waiting. */
export function MessageMetadata({
  at,
  startedAt,
  mine = false,
}: {
  at: string
  startedAt?: number
  mine?: boolean
}) {
  const date = new Date(at)
  if (!Number.isFinite(date.getTime())) return null
  const seconds =
    startedAt === undefined
      ? null
      : Math.floor((date.getTime() - startedAt) / 1000)
  const duration =
    seconds !== null && Number.isFinite(seconds) && seconds >= 0
      ? seconds < 60
        ? `${seconds}s`
        : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
      : null
  return (
    <div
      className={cn(
        'text-[10px] text-ink-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
        mine && 'text-right',
      )}
    >
      <time dateTime={at}>
        {date.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
      </time>
      {duration !== null ? ` · Turn time ${duration}` : null}
    </div>
  )
}
