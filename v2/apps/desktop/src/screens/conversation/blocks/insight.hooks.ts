import { useEffect, useState } from 'react'

/**
 * Whether the window is in dark mode, for a chart that has to be told.
 *
 * The chart library takes a theme string rather than reading the CSS
 * variables everything else here inherits, so this has to be observed. Read
 * at module scope rather than inside the hook so the effect can depend on
 * nothing and still be correct.
 */
function isDark(): boolean {
  if (typeof window === 'undefined') return false
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light') return false
  if (chosen === 'dark') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useDark(): boolean {
  const [dark, setDark] = useState(isDark)

  // A media query and an attribute are both external event sources, which is
  // the case an effect exists for.
  useEffect(() => {
    const sync = () => setDark(isDark())
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', sync)
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => {
      media.removeEventListener('change', sync)
      observer.disconnect()
    }
  }, [])

  return dark
}
