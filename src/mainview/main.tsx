import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from './components/ui/sonner'
import './index.css'
import { queryClient } from './modules/api/queryClient'
import { STORAGE_KEYS } from './modules/storage/keys'
import { ThemeApplier } from './modules/system/ThemeApplier'
import { Router } from './router'

// Pre-apply OS appearance before React mounts so users on dark OS don't
// see a light flash while `useSettings` resolves. ThemeApplier reconciles
// once the persisted preference loads.
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark')
}

// Electrobun loads the bundled view from `views://mainview/index.html`,
// which TanStack Router reads as pathname `/index.html` → 404. Normalise
// to `/` (or to a stored last-route, if one is present) BEFORE the
// router mounts. Dev mode (http://localhost:5173) is already at `/`, so
// this is a no-op there.
//
// Restored-route handling lives in this same block because both
// decisions key off the same condition: is the user currently at the
// "entry URL" the launcher set? A real deep link (any non-entry
// pathname) wins over both `/` rewrite and resume.
function isEntryPath(p: string): boolean {
  return p === '/' || p === '/index.html'
}

function safeRestoreRoute(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.lastRoute)
    if (!raw) return null
    // Sanity-check: must start with `/`, must not be the entry URL
    // itself (otherwise the rewrite below loops), must not look like
    // a protocol-relative URL.
    if (raw.startsWith('/') && !isEntryPath(raw) && !raw.startsWith('//')) {
      return raw
    }
  } catch {
    // localStorage unavailable / private mode — fall through to
    // normal launch behaviour.
  }
  return null
}

if (isEntryPath(window.location.pathname)) {
  const resume = safeRestoreRoute()
  // `replaceState` doesn't trigger navigation listeners or fire any
  // popstate events, so the router initialises with the rewritten URL
  // as its starting point with no flicker.
  history.replaceState({}, '', resume ?? '/')
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
