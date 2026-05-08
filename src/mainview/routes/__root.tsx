import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { HerbieDataProvider } from '@/modules/data/HerbieDataProvider'

export const Route = createRootRoute({
  component: () => (
    <HerbieDataProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </HerbieDataProvider>
  ),
})
