import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { STORAGE_KEYS } from '@/modules/storage/keys'

const MIN_WIDTH = 220
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 256 // 16rem — matches the shadcn primitive default

function readStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH
  const raw = window.localStorage.getItem(STORAGE_KEYS.sidebarWidth)
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

  // Owns the in-flight drag's AbortController, if any. Unmounting
  // while a drag is active aborts the controller, which atomically
  // removes both window listeners — no risk of setState on an
  // unmounted component or a leaked global listener.
  const dragAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      dragAbortRef.current?.abort()
      dragAbortRef.current = null
    }
  }, [])

  const onResizeStart = useCallback(
    (e: React.PointerEvent<Element>) => {
      e.preventDefault()
      // If a previous drag's abort somehow didn't fire (defensive),
      // cancel it before starting a new one.
      dragAbortRef.current?.abort()
      const controller = new AbortController()
      dragAbortRef.current = controller
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
        controller.abort()
        if (dragAbortRef.current === controller) {
          dragAbortRef.current = null
        }
        try {
          window.localStorage.setItem(
            STORAGE_KEYS.sidebarWidth,
            String(widthPxRef.current),
          )
        } catch {
          // Quota or private-mode failures aren't fatal — width
          // resets to default on next launch.
        }
      }
      window.addEventListener('pointermove', onMove, {
        signal: controller.signal,
      })
      window.addEventListener('pointerup', onUp, { signal: controller.signal })
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
