import { openUrl } from '@tauri-apps/plugin-opener'
import { isDesktop } from '@/modules/host/host'

/**
 * Opens a link outside the interface, in whichever way this host can.
 *
 * Something both hosts can genuinely do, so it degrades to the browser's own
 * behaviour rather than disappearing on the web.
 */
export async function openExternal(url: string): Promise<void> {
  if (!isDesktop()) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  await openUrl(url)
}
