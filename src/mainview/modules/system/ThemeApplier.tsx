import { useEffect } from 'react'
import { useTheme } from '@/modules/api/settings.hooks'

// Toggles the `dark` class on <html> based on the persisted theme.
// `system` subscribes to `prefers-color-scheme` so OS-level changes
// flow through without requiring a settings re-read.
export function ThemeApplier(): null {
  const { theme } = useTheme()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      return
    }
    if (theme === 'light') {
      root.classList.remove('dark')
      return
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => root.classList.toggle('dark', mql.matches)
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [theme])

  return null
}
