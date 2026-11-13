import { useEffect, useState } from 'react'

/** True on devices that can be touched, whatever else they claim. */
// Deliberately not the inverse of a hover-capable test: iPadOS Safari browses
// desktop-class and answers `(hover: hover) and (pointer: fine)` with true
// while a finger is the only input there is, so anything that reads
// hover-capable as "no touch here" strands every iPad.
export function useTouchCapable() {
  const [canTouch, setCanTouch] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia?.('(any-pointer: coarse)')
    // iPadOS disguises its pointer media queries; maxTouchPoints it reports
    // honestly, which is what makes it the standard iPad tell.
    const update = () =>
      setCanTouch(Boolean(mq?.matches) || navigator.maxTouchPoints > 0)
    update()
    mq?.addEventListener?.('change', update)
    return () => mq?.removeEventListener?.('change', update)
  }, [])

  return canTouch
}
