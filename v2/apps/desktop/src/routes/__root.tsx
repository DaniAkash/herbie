import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

/**
 * Context only. Every pixel belongs to `_shell`, which never unmounts, so
 * nothing here may render chrome of its own.
 */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  { component: () => <Outlet /> },
)
