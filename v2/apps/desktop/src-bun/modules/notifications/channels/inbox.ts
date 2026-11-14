import type {
  Channel,
  DeliveryResult,
} from '@bun/modules/notifications/channels/registry'
import type { StoredNotification } from '@bun/modules/notifications/store'
import { publishApp } from '@bun/modules/notifications/stream'

/**
 * The list the person can always find, whatever the operating system did.
 *
 * The row is already written by the time a channel is asked, so delivering
 * here is telling whoever is watching that it exists. That makes this the
 * one channel that cannot fail and the reason a denied notification
 * permission degrades the feature rather than silencing it.
 */
export const inboxChannel: Channel = {
  id: 'inbox',
  caps: { replace: false, needsWebview: false, richBody: true },
  available: () => Promise.resolve(true),
  deliver: (notification: StoredNotification): Promise<DeliveryResult> => {
    publishApp({ type: 'notification', notification })
    return Promise.resolve({ ok: true })
  },
}
