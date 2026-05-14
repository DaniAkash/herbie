import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { useTrayIntent } from '@/modules/system/useTrayIntent'

function RootComponent() {
  // Mounted once at the app root so tray-click navigation works
  // regardless of which screen is in the Outlet.
  useTrayIntent()
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
