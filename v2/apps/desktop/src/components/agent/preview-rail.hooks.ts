import { type MouseEvent, useCallback, useRef, useState } from 'react'
import type { PreviewRailItem } from './preview-rail.types'
import { useDismiss } from './use-dismiss'
import { useHoverGesture } from './use-hover-gesture'
import { useTapGesture } from './use-tap-gesture'

export interface RailHighlightOptions {
  items: PreviewRailItem[]
  activeId?: string
  defaultActiveId?: string
  highlightActive: boolean
  onActiveChange?: (id: string) => void
  onItemSelect?: (item: PreviewRailItem) => void
}

/**
 * Which tick is lit, and which card is out.
 *
 * Hover, a tap and focus are three separate sources rather than one "active"
 * value, because they end in different ways: a stray mouse move must not clear
 * a tick the keyboard or a finger chose, and a finger cannot hover at all.
 */
export function useRailHighlight({
  items,
  activeId,
  defaultActiveId,
  highlightActive,
  onActiveChange,
  onItemSelect,
}: RailHighlightOptions) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [internalActiveId, setInternalActiveId] = useState(
    defaultActiveId ?? items[0]?.id ?? '',
  )
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  // A click carries no pointerType, so the pointerdown before it is what says
  // whether the activation was a tap. Keyboard activation has none at all.
  const tap = useTapGesture<boolean>()
  const hover = useHoverGesture()

  const clearPinned = useCallback(() => setPinnedId(null), [])

  // The next tap outside the rail stands in for the pointer leaving it. The
  // card is a preview, so that tap passes through to whatever it landed on.
  useDismiss(pinnedId !== null, clearPinned, rootRef)

  const requested = activeId ?? internalActiveId
  const selectedId = items.some((item) => item.id === requested)
    ? requested
    : (items[0]?.id ?? '')
  const displayedId = hoveredId ?? pinnedId ?? focusedId ?? ''
  const highlightedId = displayedId || (highlightActive ? selectedId : '')

  const select = (item: PreviewRailItem) => (event: MouseEvent) => {
    const gesture = tap.take()
    if (gesture !== null && gesture.pointerType !== 'mouse') {
      // A link would otherwise show its preview and leave the page in the same
      // tap, so the card is never read: the first tap lights the tick, the
      // second follows the link.
      if (item.href && !gesture.state) {
        event.preventDefault()
        setPinnedId(item.id)
        return
      }
      setPinnedId(item.id)
    }
    if (activeId === undefined) setInternalActiveId(item.id)
    onActiveChange?.(item.id)
    onItemSelect?.(item)
  }

  return {
    rootRef,
    selectedId,
    displayedId,
    highlightedId,
    displayedIndex: items.findIndex((item) => item.id === highlightedId),
    select,
    enter: (
      item: PreviewRailItem,
      event: Parameters<typeof hover.enter>[0],
    ) => {
      if (hover.enter(event)) setHoveredId(item.id)
    },
    leave: (event: Parameters<typeof hover.leave>[0]) => {
      if (hover.leave(event)) setHoveredId(null)
    },
    press: (item: PreviewRailItem, event: { pointerType: string }) => {
      tap.start(event, pinnedId === item.id)
      setFocusedId(null)
    },
    // A gesture the platform takes away sends no click, and a key press starts
    // an activation that never had a pointer behind it: either one leaves a
    // record the next click would read as a tap of its own.
    dropGesture: tap.drop,
    focusItem: (item: PreviewRailItem, element: HTMLElement) => {
      if (element.matches(':focus-visible')) setFocusedId(item.id)
    },
    // Both tick sources leave with the focus: a tap does not always land
    // focus, but when it does, tabbing away must not strand the card.
    blurAway: () => {
      setFocusedId(null)
      setPinnedId(null)
    },
  }
}
