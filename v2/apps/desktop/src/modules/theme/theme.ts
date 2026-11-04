import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'
const KEY = 'herbie-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

let theme = readTheme()
const listeners = new Set<() => void>()

function applyTheme() {
  const dark = theme === 'dark' || (theme === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function setTheme(next: Theme) {
  theme = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // The current session can still change theme if storage is unavailable.
  }
  applyTheme()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  return useSyncExternalStore(
    subscribe,
    () => theme,
    () => 'system' as Theme,
  )
}

media.addEventListener('change', () => {
  if (theme === 'system') applyTheme()
})
window.addEventListener('storage', (event) => {
  if (event.key !== KEY) return
  theme = readTheme()
  applyTheme()
  for (const listener of listeners) listener()
})
applyTheme()
