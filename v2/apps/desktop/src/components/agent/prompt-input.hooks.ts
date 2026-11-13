import { type RefObject, useCallback, useEffect, useLayoutEffect } from 'react'

const LINE_HEIGHT = 24

export interface AutoGrowOptions {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  measurementRef: RefObject<HTMLDivElement | null>
  value: string
  minRows: number
  maxRows: number
}

/**
 * Sizes the textarea from a hidden twin rather than from its own scrollHeight,
 * which only ever grows: shrinking a textarea needs a height that was measured
 * without one already set.
 */
export function useAutoGrowTextarea({
  textareaRef,
  measurementRef,
  value,
  minRows,
  maxRows,
}: AutoGrowOptions) {
  const resize = useCallback(() => {
    const textarea = textareaRef.current
    const measurement = measurementRef.current
    if (!textarea || !measurement || textarea.value !== value) return

    const next = Math.min(
      Math.max(measurement.scrollHeight, minRows * LINE_HEIGHT),
      maxRows * LINE_HEIGHT,
    )
    const height = `${next}px`
    if (textarea.style.height !== height) textarea.style.height = height
  }, [maxRows, measurementRef, minRows, textareaRef, value])

  useLayoutEffect(() => {
    resize()
  }, [resize])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(resize)
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [resize, textareaRef])
}
