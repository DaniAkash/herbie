/**
 * Which theme the window is in, and the one place that writes it.
 *
 * The class on the document element is the single mechanism, because that is
 * what the token layer's `dark` variant keys off and what shadcn and
 * animate-ui components expect. An explicit choice is persisted and wins; with
 * no choice stored the window follows the system and keeps following it.
 *
 * The writer lives outside React so the class is on the element before the
 * first paint, which is why readers subscribe rather than own the state.
 */

import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'herbie.theme'
const SYSTEM_DARK = '(prefers-color-scheme: dark)'

const listeners = new Set<() => void>()

let choice: Theme | undefined

function read(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function getChoice(): Theme {
  if (choice === undefined) choice = read()
  return choice
}

export function isDark(): boolean {
  const current = getChoice()
  if (current !== 'system') return current === 'dark'
  return window.matchMedia(SYSTEM_DARK).matches
}

function paint(): void {
  const dark = isDark()
  document.documentElement.classList.toggle('dark', dark)
  // Native controls and scrollbars draw themselves from this, not from the class.
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  for (const listener of listeners) listener()
}

/** Applies the theme now and keeps it following the system. Call once. */
export function startTheme(): void {
  paint()
  window.matchMedia(SYSTEM_DARK).addEventListener('change', paint)
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    choice = read()
    paint()
  })
}

export function setTheme(next: Theme): void {
  choice = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // The session can still change theme when storage is unavailable.
  }
  paint()
}

export function subscribeToTheme(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** The stored choice, for a control that offers all three. */
export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribeToTheme,
    getChoice,
    () => 'system' as Theme,
  )
}
