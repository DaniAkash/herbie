import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'

const SMOOTH_SETTLE_MS = 320

export interface ScrollControls {
  scrollToEnd: (behavior: ScrollBehavior) => void
  scrollToTop: (top: number, behavior: ScrollBehavior) => void
  setFollowing: (next: boolean) => void
  isFollowing: () => boolean
  isProgrammatic: () => boolean
  releaseProgrammatic: () => void
}

/**
 * Scrolling the viewport ourselves, kept apart from the reader doing it.
 *
 * A programmatic scroll fires the same scroll event a reader's does, so it is
 * flagged for as long as a smooth scroll takes to settle; otherwise the jump
 * to the end reads as the reader choosing to leave the live edge.
 */
export function useScrollControls(
  viewportRef: RefObject<HTMLElement | null>,
  followOutput: boolean,
  onFollowChange?: (following: boolean) => void,
): ScrollControls {
  const followingRef = useRef(followOutput)
  const programmaticRef = useRef(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const scrollToTop = useCallback(
    (top: number, behavior: ScrollBehavior) => {
      const viewport = viewportRef.current
      if (!viewport) return
      programmaticRef.current = true
      if (typeof viewport.scrollTo === 'function') {
        viewport.scrollTo({ top, behavior })
      } else {
        viewport.scrollTop = top
      }
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(
        () => {
          programmaticRef.current = false
        },
        behavior === 'smooth' ? SMOOTH_SETTLE_MS : 0,
      )
    },
    [viewportRef],
  )

  const scrollToEnd = useCallback(
    (behavior: ScrollBehavior) => {
      const viewport = viewportRef.current
      if (viewport) scrollToTop(viewport.scrollHeight, behavior)
    },
    [scrollToTop, viewportRef],
  )

  const setFollowing = useCallback(
    (next: boolean) => {
      if (followingRef.current === next) return
      followingRef.current = next
      onFollowChange?.(next)
    },
    [onFollowChange],
  )

  return {
    scrollToEnd,
    scrollToTop,
    setFollowing,
    isFollowing: () => followingRef.current,
    isProgrammatic: () => programmaticRef.current,
    releaseProgrammatic: () => {
      programmaticRef.current = false
    },
  }
}

export interface FollowOutputOptions {
  contentRef: RefObject<HTMLElement | null>
  controls: ScrollControls
  followOutput: boolean
  smooth: boolean
  onResize: () => void
}

/** Pins the viewport to the end while the reader stays near it. */
export function useFollowOutput({
  contentRef,
  controls,
  followOutput,
  smooth,
  onResize,
}: FollowOutputOptions) {
  const { scrollToEnd, setFollowing, isFollowing } = controls

  useLayoutEffect(() => {
    setFollowing(followOutput)
    if (!followOutput) return
    const frame = requestAnimationFrame(() => scrollToEnd('auto'))
    return () => cancelAnimationFrame(frame)
  }, [followOutput, scrollToEnd, setFollowing])

  useEffect(() => {
    const content = contentRef.current
    if (!content || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      onResize()
      if (!followOutput || !isFollowing()) return
      scrollToEnd(smooth ? 'smooth' : 'auto')
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [contentRef, followOutput, isFollowing, onResize, scrollToEnd, smooth])
}
