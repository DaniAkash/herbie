import { type ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const GLIDE =
  'top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease'

/**
 * A single hover layer that glides between the rows of a menu.
 *
 * One moving span rather than a background on each row, so the highlight
 * travels between them instead of appearing and disappearing in place.
 *
 * The listeners are attached to the container rather than written as props,
 * because the container is a layout wrapper and not itself a control: the rows
 * inside it are the buttons. `mouseover`, `focusin` and `focusout` all bubble,
 * so one listener each covers every row, and the highlight follows the
 * keyboard as well as the pointer.
 */
export function GlideMenu({
  children,
  className,
  highlightClassName = 'inset-x-0 rounded-[8px] bg-hover',
}: {
  children: ReactNode
  className?: string
  highlightClassName?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const moveTo = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return
      const row = target.closest('[data-menu-row]')
      if (!(row instanceof HTMLElement) || !container.contains(row)) return
      const containerRect = container.getBoundingClientRect()
      const rowRect = row.getBoundingClientRect()
      setBox({ top: rowRect.top - containerRect.top, height: rowRect.height })
      setVisible(true)
    }

    const onOver = (event: Event) => moveTo(event.target)
    const onLeave = () => setVisible(false)
    const onFocusOut = (event: FocusEvent) => {
      if (!container.contains(event.relatedTarget as Node | null)) {
        setVisible(false)
      }
    }

    container.addEventListener('mouseover', onOver)
    container.addEventListener('mouseleave', onLeave)
    container.addEventListener('focusin', onOver)
    container.addEventListener('focusout', onFocusOut)
    return () => {
      container.removeEventListener('mouseover', onOver)
      container.removeEventListener('mouseleave', onLeave)
      container.removeEventListener('focusin', onOver)
      container.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return (
    <div ref={ref} className={cn('group/glide-menu relative', className)}>
      <span
        aria-hidden="true"
        className={cn('pointer-events-none absolute', highlightClassName)}
        style={{
          top: box?.top ?? 0,
          height: box?.height ?? 0,
          opacity: box && visible ? 1 : 0,
          transition: GLIDE,
        }}
      />
      {children}
    </div>
  )
}
