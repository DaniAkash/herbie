import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { API_BASE_URL } from '../api/client'

// Polls the loopback intent endpoint and navigates whenever the bun
// side has stashed a route there. The bun-side click handler fires
// just before showing the main window, so by the time the renderer
// is visible there's typically a pending intent waiting.
//
// Polling only runs while the window is visible — when hidden, the
// user can't see the navigation anyway and we save the requests.
const POLL_MS = 1000

export function useTrayIntent(): void {
  const router = useRouter()
  // Stash router in a ref so the effect can stay mounted once and
  // not re-run when the router instance (stable, but TS doesn't know
  // that) appears to change.
  const routerRef = useRef(router)
  routerRef.current = router

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let aborted = false

    async function poll(): Promise<void> {
      if (aborted) return
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`${API_BASE_URL}/internal/tray-intent`)
        if (!res.ok) return
        const intent = (await res.json()) as { to: string } | null
        if (!intent?.to) return
        // `to` is a literal path like "/chat/abc" or "/inbox". TanStack
        // accepts it as `Parameters<typeof navigate>[0]['to']` via the
        // wildcard string overload.
        routerRef.current.navigate({ to: intent.to as never })
      } catch {
        // Network/parse errors are silent — the next poll retries.
      }
    }

    function start(): void {
      if (timer) return
      // Fire immediately so a tray click that lands while the window
      // was hidden navigates as soon as it's visible again.
      void poll()
      timer = setInterval(poll, POLL_MS)
    }

    function stop(): void {
      if (!timer) return
      clearInterval(timer)
      timer = null
    }

    function handleVisibility(): void {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', poll)

    return () => {
      aborted = true
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', poll)
      stop()
    }
  }, [])
}
