import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from './components/ui/sonner'
import './index.css'
import { queryClient } from './modules/api/queryClient'
import { Router } from './router'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster richColors closeButton position="bottom-right" />
    </QueryClientProvider>
  </StrictMode>,
)
