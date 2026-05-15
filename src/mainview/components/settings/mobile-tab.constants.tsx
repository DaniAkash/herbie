import { cn } from '@/lib/utils'

// Shared little 2-column row used in both the connection card and
// the read-only "pinned at creation" block inside the edit form.
export function DetailRow({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          'truncate text-[12px]',
          mono ? 'font-mono text-muted-foreground' : '',
        )}
      >
        {value}
      </span>
    </div>
  )
}
