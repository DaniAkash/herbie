import { useSyncExternalStore } from 'react'
import { isDark, subscribeToTheme } from '@/modules/theme/theme'

/** For anything that has to be told the theme rather than inheriting a token. */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribeToTheme, isDark, () => false)
}
