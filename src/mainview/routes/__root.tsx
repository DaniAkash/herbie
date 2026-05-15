import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { STORAGE_KEYS } from '@/modules/storage/keys'
import { useTrayIntent } from '@/modules/system/useTrayIntent'

// Writes pathname+search to localStorage on every route change so the
// next launch (or tray reopen) can resume here. Lives inside the
// router tree so `useLocation()` is available. Failures are silent —
// the user just doesn't get route resume.
function LocationPersister() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    try {
      // search comes through as a typed object from TanStack Router; if
      // any values are present, serialise to a query string. We
      // intentionally don't persist hash — the app doesn't use it.
      const searchEntries = Object.entries(
        (search ?? {}) as Record<string, unknown>,
      ).filter(([, v]) => v !== undefined && v !== null)
      const queryString =
        searchEntries.length > 0
          ? `?${new URLSearchParams(
              searchEntries.map(([k, v]) => [k, String(v)]),
            ).toString()}`
          : ''
      window.localStorage.setItem(
        STORAGE_KEYS.lastRoute,
        pathname + queryString,
      )
    } catch {
      // localStorage unavailable — silently degrade.
    }
  }, [pathname, search])
  return null
}

function RootComponent() {
  // Mounted once at the app root so tray-click navigation works
  // regardless of which screen is in the Outlet.
  useTrayIntent()
  return (
    <AppShell>
      <LocationPersister />
      <Outlet />
    </AppShell>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
