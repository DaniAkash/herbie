import { useNavigate } from '@tanstack/react-router'
import {
  CenterMorphModal,
  CenterMorphModalContent,
} from '@/components/motion/center-morph-modal'
import { cn } from '@/lib/utils'
import { closeOverlay } from '@/modules/navigation/overlay'

/**
 * The shell every overlay sits in.
 *
 * beui's CenterMorphModal, held open by the route rather than by a trigger:
 * the overlay is a search param, so the url is what opens and closes it. Its
 * own close button and backdrop dismissal both navigate, which is what makes
 * the back button work without any state of ours.
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
  const dismiss = () => navigate({ to: '.', search: closeOverlay })

  return (
    <CenterMorphModal
      open
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <CenterMorphModalContent
        ariaLabel={title}
        className={cn(
          'grid max-h-[82vh] grid-rows-[auto_1fr_auto] overflow-hidden rounded-card bg-surface',
          narrow ? 'w-[min(380px,100%)]' : 'w-[min(540px,100%)]',
        )}
      >
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
          {lead}
          <h3 className="flex-1 font-semibold text-[15.5px]">{title}</h3>
        </div>
        <div className="quiet-scroll min-h-0 overflow-y-auto px-[18px] pt-3 pb-[18px]">
          {children}
        </div>
        {footer ? (
          <div className="flex justify-end gap-2 px-4 pb-4">{footer}</div>
        ) : (
          <div />
        )}
      </CenterMorphModalContent>
    </CenterMorphModal>
  )
}
