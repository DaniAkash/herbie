import type {
  Channel,
  DeliveryResult,
} from '@bun/modules/notifications/channels/registry'
import type { StoredNotification } from '@bun/modules/notifications/store'
import { appWatcherCount } from '@bun/modules/notifications/stream'

/**
 * The banner, which this process cannot draw.
 *
 * Only the shell can post one, and only the window can tell the shell, so
 * what happens here is that the intent is handed to whoever is listening on
 * the app wide stream. The inbox channel does the publishing for both,
 * because a notification is one thing on the wire rather than two.
 *
 * This is also the one channel that dies with the renderer, which is what
 * `needsWebview` tells the core: with no window there is nobody to relay to,
 * and saying so plainly is better than reporting a delivery that never
 * reached a screen.
 */
export const desktopChannel: Channel = {
  id: 'desktop',
  caps: { replace: true, needsWebview: true, richBody: false },
  available: () => Promise.resolve(appWatcherCount() > 0),
  deliver: (_notification: StoredNotification): Promise<DeliveryResult> =>
    Promise.resolve(
      appWatcherCount() > 0
        ? { ok: true }
        : { ok: false, reason: 'no window listening' },
    ),
}
