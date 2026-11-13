import { useReducedMotion } from 'motion/react'
import { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useMessageRail } from './message-rail.hooks'
import { useFollowOutput, useScrollControls } from './message-scroller.hooks'
import type { MessageScrollerProps } from './message-scroller.types'
import { PreviewRail } from './PreviewRail'

const RAIL_PREVIEW_CLASS =
  'mr-1 w-64 max-w-full [&_[data-slot=preview-rail-card]]:h-20 [&_[data-slot=preview-rail-card]]:overflow-hidden [&_[data-slot=preview-rail-card]]:p-3 [&_[data-slot=preview-rail-title]]:line-clamp-1 [&_[data-slot=preview-rail-title]]:text-xs [&_[data-slot=preview-rail-title]]:leading-4 [&_[data-slot=preview-rail-description]]:line-clamp-2 [&_[data-slot=preview-rail-description]]:text-xs [&_[data-slot=preview-rail-description]]:leading-4'

const RAIL_CLASS =
  'absolute inset-y-3 right-1 w-7 content-center py-1 [&_[data-slot=preview-rail-item]]:w-7 [&_[data-slot=preview-rail-item]]:justify-end [&_[data-slot=preview-rail-tick]]:h-px [&_[data-slot=preview-rail-tick]]:w-4 [&_[data-slot=preview-rail-tick]]:origin-right'

export function MessageScroller({
  followOutput = true,
  followThreshold = 56,
  smooth = true,
  onFollowChange,
  label = 'Conversation',
  busy,
  navigation,
  navigationLabel = 'Message navigation',
  viewportClassName,
  contentClassName,
  railClassName,
  viewportRef: externalViewportRef,
  viewportProps,
  contentProps,
  className,
  children,
  ...props
}: MessageScrollerProps) {
  const reduce = useReducedMotion() ?? false
  const animated = smooth && !reduce
  const viewportRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const railEnabled = navigation === 'rail'
  const {
    onScroll: onViewportScroll,
    onWheel: onViewportWheel,
    onTouchStart: onViewportTouchStart,
    onKeyDown: onViewportKeyDown,
    ...restViewportProps
  } = viewportProps ?? {}

  const controls = useScrollControls(viewportRef, followOutput, onFollowChange)
  const rail = useMessageRail({
    enabled: railEnabled,
    viewportRef,
    contentRef,
    controls,
    followThreshold,
    smooth: animated,
  })

  useFollowOutput({
    contentRef,
    controls,
    followOutput,
    smooth: animated,
    onResize: rail.sync,
  })

  const setViewportRef = useCallback(
    (node: HTMLElement | null) => {
      viewportRef.current = node
      if (typeof externalViewportRef === 'function') externalViewportRef(node)
      else if (externalViewportRef) externalViewportRef.current = node
    },
    [externalViewportRef],
  )

  const handleScroll = () => {
    const viewport = viewportRef.current
    if (!viewport || controls.isProgrammatic()) return
    const distance =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    controls.setFollowing(distance <= followThreshold)
    rail.updateActive()
  }

  const viewport = (
    <section
      ref={setViewportRef}
      aria-label={label}
      {...restViewportProps}
      onScroll={(event) => {
        handleScroll()
        onViewportScroll?.(event)
      }}
      onWheel={(event) => {
        controls.releaseProgrammatic()
        onViewportWheel?.(event)
      }}
      onTouchStart={(event) => {
        controls.releaseProgrammatic()
        onViewportTouchStart?.(event)
      }}
      onKeyDown={(event) => {
        // A deliberate move upward is the reader taking over, and the scroll it
        // causes must not be mistaken for one of ours.
        if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) {
          controls.releaseProgrammatic()
        }
        onViewportKeyDown?.(event)
      }}
      className={cn(
        'h-full overflow-y-auto overscroll-contain outline-none [overflow-anchor:none] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        railEnabled
          ? '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : '[scrollbar-gutter:stable]',
        viewportClassName,
        railEnabled && rail.overflowing && 'pr-10',
      )}
    >
      <div
        ref={contentRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={busy}
        className={contentClassName}
        {...contentProps}
      >
        {children}
      </div>
    </section>
  )

  return (
    <div
      data-slot="message-scroller"
      className={cn('min-h-0', className)}
      {...props}
    >
      {railEnabled ? (
        <PreviewRail
          items={rail.overflowing ? rail.items : []}
          label={navigationLabel}
          activeId={rail.activeId}
          onItemSelect={rail.scrollToItem}
          previewSide="before"
          highlightActive
          itemSize={14}
          className="h-full min-h-0 overflow-hidden"
          previewContainerClassName="right-8 left-3"
          previewClassName={RAIL_PREVIEW_CLASS}
          railClassName={cn(
            RAIL_CLASS,
            rail.overflowing
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0',
            railClassName,
          )}
        >
          {viewport}
        </PreviewRail>
      ) : (
        viewport
      )}
    </div>
  )
}
