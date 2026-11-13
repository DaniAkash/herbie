import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { queryClient } from '@/modules/api/queryClient'
import { startTheme } from '@/modules/theme/theme'
import { routeTree } from './routeTree.gen'
import './index.css'

const router = createRouter({ routeTree, context: { queryClient } })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('no #root element')

// Before the first render, so the window never paints light and then flips.
startTheme()

createRoot(root).render(
  <StrictMode>
    {/*
      The provider wraps the router rather than living on a route, so the cache
      is created once and survives every navigation.
    */}
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
