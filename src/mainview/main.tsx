import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from './components/ui/sonner'
import './index.css'
import { queryClient } from './modules/api/queryClient'
import { ThemeApplier } from './modules/system/ThemeApplier'
import { Router } from './router'

// Pre-apply OS appearance before React mounts so users on dark OS don't
// see a light flash while `useSettings` resolves. ThemeApplier reconciles
// once the persisted preference loads.
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark')
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      <Router />
      <Toaster richColors closeButton position="bottom-right" />
    </QueryClientProvider>
  </StrictMode>,
)
