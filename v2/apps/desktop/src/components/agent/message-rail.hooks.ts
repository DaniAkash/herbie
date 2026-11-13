import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { buildRailItems, nearestRailId } from './message-scroller.helpers'
import type { ScrollControls } from './message-scroller.hooks'
import type { PreviewRailItem } from './preview-rail.types'

export interface MessageRail {
  items: PreviewRailItem[]
  activeId: string
  overflowing: boolean
  sync: () => void
  updateActive: () => void
  scrollToItem: (item: PreviewRailItem) => void
}

export interface MessageRailOptions {
  enabled: boolean
  viewportRef: RefObject<HTMLElement | null>
  contentRef: RefObject<HTMLElement | null>
  controls: ScrollControls
  followThreshold: number
  smooth: boolean
}

function sameItems(a: PreviewRailItem[], b: PreviewRailItem[]) {
  return (
    a.length === b.length &&
    a.every(
      (item, index) =>
        item.id === b[index]?.id &&
        item.label === b[index]?.label &&
        item.description === b[index]?.description &&
        item.ariaLabel === b[index]?.ariaLabel,
    )
  )
}

/** The minimap of the transcript, built by scraping the rendered messages. */
export function useMessageRail({
  enabled,
  viewportRef,
  contentRef,
  controls,
  followThreshold,
  smooth,
}: MessageRailOptions): MessageRail {
  const idsRef = useRef(new WeakMap<HTMLElement, string>())
  const counterRef = useRef(0)
  const targetsRef = useRef(new Map<string, HTMLElement>())
  const frameRef = useRef<number | undefined>(undefined)
  const [items, setItems] = useState<PreviewRailItem[]>([])
  const [activeId, setActiveId] = useState('')
  const [overflowing, setOverflowing] = useState(false)

  const updateActive = useCallback(() => {
    const viewport = viewportRef.current
    const targets = [...targetsRef.current.entries()]
    if (!enabled || !viewport || targets.length === 0) return
    const next = nearestRailId(viewport, targets, followThreshold)
    setActiveId((current) => (current === next ? current : next))
  }, [enabled, followThreshold, viewportRef])

  const readItems = useCallback(() => {
    const content = contentRef.current
    const viewport = viewportRef.current
    if (!enabled || !content || !viewport) return

    const read = buildRailItems(content, viewport, idsRef.current, () => {
      counterRef.current += 1
      return `message-rail-${counterRef.current}`
    })
    targetsRef.current = read.targets
    setItems((current) =>
      sameItems(current, read.items) ? current : read.items,
    )
    setOverflowing(read.overflowing)
  }, [contentRef, enabled, viewportRef])

  const sync = useCallback(() => {
    if (!enabled) return
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      readItems()
      updateActive()
    })
  }, [enabled, readItems, updateActive])

  useEffect(() => {
    if (!enabled) {
      targetsRef.current.clear()
      setItems([])
      setOverflowing(false)
      return
    }

    const content = contentRef.current
    const viewport = viewportRef.current
    if (!content || !viewport) return

    sync()
    const mutations =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(sync)
    mutations?.observe(content, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    const resizes =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    resizes?.observe(content)
    resizes?.observe(viewport)

    return () => {
      mutations?.disconnect()
      resizes?.disconnect()
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [contentRef, enabled, sync, viewportRef])

  const scrollToItem = useCallback(
    (item: PreviewRailItem) => {
      const viewport = viewportRef.current
      const target = targetsRef.current.get(item.id)
      if (!viewport || !target) return

      setActiveId(item.id)
      const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto'

      // The last entry is the live edge, so choosing it resumes following.
      if (items.at(-1)?.id === item.id) {
        controls.setFollowing(true)
        controls.scrollToEnd(behavior)
        return
      }

      controls.setFollowing(false)
      const viewportRect = viewport.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      controls.scrollToTop(
        viewport.scrollTop +
          targetRect.top -
          viewportRect.top -
          (viewport.clientHeight - targetRect.height) / 2,
        behavior,
      )
    },
    [controls, items, smooth, viewportRef],
  )

  return { items, activeId, overflowing, sync, updateActive, scrollToItem }
}
