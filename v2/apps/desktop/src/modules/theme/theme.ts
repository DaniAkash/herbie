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

type ThemeChoice = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'herbie.theme'
const SYSTEM_DARK = '(prefers-color-scheme: dark)'

const listeners = new Set<() => void>()

let choice: ThemeChoice | undefined

function getChoice(): ThemeChoice {
  if (choice === undefined) {
    const stored = localStorage.getItem(STORAGE_KEY)
    choice = stored === 'light' || stored === 'dark' ? stored : 'system'
  }
  return choice
}

export function isDark(): boolean {
  const current = getChoice()
  if (current !== 'system') return current === 'dark'
  return window.matchMedia(SYSTEM_DARK).matches
}

function paint(): void {
  document.documentElement.classList.toggle('dark', isDark())
  for (const listener of listeners) listener()
}

/** Applies the theme now and keeps it following the system. Call once. */
export function startTheme(): void {
  paint()
  window.matchMedia(SYSTEM_DARK).addEventListener('change', paint)
}

export function subscribeToTheme(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}
