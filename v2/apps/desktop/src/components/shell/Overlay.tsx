import { useNavigate } from '@tanstack/react-router'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { closeOverlay } from '@/modules/navigation/overlay'

/**
 * The shell every overlay sits in.
 *
 * animate-ui's Base UI dialog, held open by the route rather than by a
 * trigger: the overlay is a search param, so the url is what opens and closes
 * it. Its own close button and backdrop dismissal both navigate, which is
 * what makes the back button work without any state of ours.
 *
 * The bangs undo the component's own `p-4`, `gap-4` and `sm:max-w-sm`. This
 * overlay sets its own padding per region because the body scrolls and the
 * header and footer do not, so one padding on the popup would scroll the
 * header away with the content.
 */
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
  const navigate = useNavigate()

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) navigate({ to: '.', search: closeOverlay })
      }}
    >
      <DialogContent
        className={cn(
          '!p-0 !gap-0 !max-w-none grid max-h-[82vh] grid-rows-[auto_1fr_auto] overflow-hidden rounded-card bg-surface',
          narrow ? 'w-[min(380px,100%)]' : 'w-[min(540px,100%)]',
        )}
      >
        <div className="flex items-center gap-2 px-4 pt-3.5 pr-11 pb-1">
          {lead}
          <DialogTitle className="flex-1 font-semibold text-[15.5px] leading-normal">
            {title}
          </DialogTitle>
        </div>
        <div className="quiet-scroll min-h-0 overflow-y-auto px-[18px] pt-3 pb-[18px]">
          {children}
        </div>
        {footer ? (
          <div className="flex justify-end gap-2 px-4 pb-4">{footer}</div>
        ) : (
          <div />
        )}
      </DialogContent>
    </Dialog>
  )
}
