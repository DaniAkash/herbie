import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { API_BASE_URL } from '../api/client'

// Polls the loopback intent endpoint and navigates whenever the bun
// side has stashed a route there. The bun-side click handler fires
// just before showing the main window, so by the time the renderer
// is visible there's typically a pending intent waiting.
//
// 250ms cadence while visible — single localhost GET, totally fine.
// Polling pauses entirely when the window is hidden (saves requests
// and the navigation wouldn't be visible anyway).
const POLL_MS = 250

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
        // Intents are raw URL paths like "/chat/abc". router.navigate's
        // type-narrowing won't accept those for parameterized routes
        // (it wants `to: '/chat/$id', params: { id }`). history.push
        // skips the type wall and lets the router re-resolve from the
        // new URL, which matches the file-based route tree correctly.
        routerRef.current.history.push(intent.to)
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
