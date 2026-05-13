import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const MIN_WIDTH = 220
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 256 // 16rem — matches the shadcn primitive default
const STORAGE_KEY = 'herbie:sidebar-width'

function readStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(parsed)) return DEFAULT_WIDTH
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed))
}

export function useSidebarWidth(): {
  widthPx: number
  onResizeStart: (e: React.PointerEvent<Element>) => void
} {
  const [widthPx, setWidthPx] = useState<number>(readStoredWidth)
  // Keep a ref so the pointerup handler reads the LATEST width — the
  // listener captures values at drag-start otherwise.
  const widthPxRef = useRef(widthPx)
  useEffect(() => {
    widthPxRef.current = widthPx
  }, [widthPx])

  const onResizeStart = useCallback(
    (e: React.PointerEvent<Element>) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = widthPx

      function onMove(ev: PointerEvent) {
        const next = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)),
        )
        setWidthPx(next)
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        try {
          window.localStorage.setItem(STORAGE_KEY, String(widthPxRef.current))
        } catch {
          // Quota or private-mode failures aren't fatal — width
          // resets to default on next launch.
        }
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [widthPx],
  )

  return { widthPx, onResizeStart }
}

export function SidebarResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent<Element>) => void
}) {
  return (
    <button
      type="button"
      aria-label="Resize sidebar"
      onPointerDown={onPointerDown}
      className={cn(
        // 4px-wide invisible hit area pinned to the sidebar's right edge.
        // Highlights on hover/active so the drag affordance is discoverable
        // without permanent visual chrome.
        'absolute top-0 right-0 z-20 h-full w-1 cursor-col-resize bg-transparent outline-none transition-colors hover:bg-border/60 focus-visible:bg-border/80 active:bg-border',
      )}
    />
  )
}
