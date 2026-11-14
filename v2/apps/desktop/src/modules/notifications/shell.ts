import { invoke } from '@tauri-apps/api/core'
import { isDesktop } from '@/modules/host/host'

/**
 * The shell commands, behind a host check.
 *
 * Everything here draws something only a native window has: a banner, a dock
 * badge, a menu bar icon. The web build has none of them and `invoke` there
 * would throw, so each call answers with the no-op that matches what the web
 * build can actually do rather than failing.
 */

export interface NotifyIntent {
  readonly id: string
  readonly agentId: string
  readonly title: string
  readonly subtitle?: string
  readonly body: string
  readonly route: string
  readonly updates: number
  readonly kind: string
  readonly shape: string
  readonly color: string
  readonly sound: boolean
}

export async function postNotification(intent: NotifyIntent): Promise<void> {
  if (!isDesktop()) return
  await invoke('post_notification', { intent })
}

export async function withdrawNotification(agentId: string): Promise<void> {
  if (!isDesktop()) return
  await invoke('withdraw_notification', { agentId })
}

export async function setAttention(waiting: number): Promise<void> {
  if (!isDesktop()) return
  await invoke('set_notification_attention', { waiting })
}

/**
 * Whether a banner has ever reached the screen.
 *
 * The only observable the window has. `isPermissionGranted` answers true on
 * every desktop platform whatever System Settings says, so the preferences
 * pane reports from this instead of claiming a permission it cannot read.
 */
export async function hasDelivered(): Promise<boolean> {
  if (!isDesktop()) return false
  return invoke<boolean>('notification_delivered')
}
