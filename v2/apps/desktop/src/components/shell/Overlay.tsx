import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { closeOverlay } from '@/modules/navigation/overlay'

/** The shared shell every overlay sits in. */
export function Overlay({
  title,
  narrow = false,
  footer,
  children,
  lead,
}: {
  title: string
  narrow?: boolean
  footer?: React.ReactNode
  children: React.ReactNode
  lead?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'grid max-h-full grid-rows-[auto_1fr_auto] overflow-hidden rounded-card bg-surface shadow-overlay',
        narrow ? 'w-[min(380px,100%)]' : 'w-[min(540px,100%)]',
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
        {lead}
        <h3 className="flex-1 font-semibold text-[15.5px]">{title}</h3>
        <Link
          to="."
          search={closeOverlay}
          aria-label="Close"
          className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink"
        >
          <X size={16} />
        </Link>
      </div>
      <div className="min-h-0 overflow-y-auto px-[18px] pt-3 pb-[18px]">
        {children}
      </div>
      {footer ? (
        <div className="flex justify-end gap-2 px-4 pb-4">{footer}</div>
      ) : (
        <div />
      )}
    </div>
  )
}
