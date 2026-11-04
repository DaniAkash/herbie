import { Check, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Which of the two steps you are on, and what the first one decided. */
export function Steps({ name }: { name?: string }) {
  const onSecond = Boolean(name)
  return (
    <div className="mb-4 flex items-center gap-2 text-[12.5px]">
      <Step n="1" current={!onSecond} done={onSecond}>
        {name || 'Who it is'}
      </Step>
      <span className="h-px flex-1 bg-line" />
      <Step n="2" current={onSecond}>
        How it runs
      </Step>
    </div>
  )
}

function Step({
  n,
  current,
  done = false,
  children,
}: {
  n: string
  current: boolean
  done?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      aria-current={current ? 'step' : undefined}
      className={cn(
        'flex min-w-0 items-center gap-1.5',
        current ? 'font-medium text-ink' : 'text-ink-3',
      )}
    >
      <span
        className={cn(
          'grid size-[17px] shrink-0 place-items-center rounded-full text-[10.5px] leading-none',
          current || done ? 'bg-ink text-canvas' : 'bg-hover-2 text-ink-3',
        )}
      >
        {done ? <Check size={9} strokeWidth={3} /> : n}
      </span>
      <span className="truncate">{children}</span>
    </span>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="-ml-1 inline-flex size-7 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink"
    >
      <ChevronLeft size={16} />
    </button>
  )
}
