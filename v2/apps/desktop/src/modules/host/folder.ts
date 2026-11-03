import { open } from '@tauri-apps/plugin-dialog'
import { isDesktop } from '@/modules/host/host'

/**
 * Asks the OS for a folder.
 *
 * Null covers both cancelling and the web page, where there is no OS dialog to
 * ask: neither is an error, and both mean the folder has not changed.
 */
export async function chooseFolder(
  defaultPath?: string,
): Promise<string | null> {
  if (!isDesktop()) return null
  const picked = await open({ directory: true, multiple: false, defaultPath })
  return typeof picked === 'string' ? picked : null
}

/** The folder a planned path would be made in, which is the one that exists. */
export function parentOf(path: string): string | undefined {
  const cut = path.lastIndexOf('/')
  return cut > 0 ? path.slice(0, cut) : undefined
}
