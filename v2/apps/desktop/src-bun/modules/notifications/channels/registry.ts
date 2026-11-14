import type { ChannelId } from '@bun/modules/notifications/decide'
import type { StoredNotification } from '@bun/modules/notifications/store'

/**
 * Where a notification can go, and what each way of going can manage.
 *
 * A channel declares what it can do rather than being asked, so the core can
 * degrade without knowing which channels exist. Adding one is implementing
 * this and registering it.
 */

export interface ChannelCaps {
  /** Can withdraw a delivered notification and post a fresh one. */
  readonly replace: boolean
  /** Dies with the renderer, so it cannot be relied on when the window is gone. */
  readonly needsWebview: boolean
  readonly richBody: boolean
}

export type DeliveryResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

export interface Channel {
  readonly id: ChannelId
  readonly caps: ChannelCaps
  available(): Promise<boolean>
  deliver(notification: StoredNotification): Promise<DeliveryResult>
}

const registered = new Map<ChannelId, Channel>()

export function registerChannel(channel: Channel): void {
  registered.set(channel.id, channel)
}

/**
 * The channels a decision asked for, skipping any that is not installed.
 *
 * A decision naming a channel nobody registered is not an error: it is how
 * `telegram` can sit in the routing before its client exists.
 */
export function channelsFor(ids: readonly ChannelId[]): readonly Channel[] {
  return ids
    .map((id) => registered.get(id))
    .filter((channel): channel is Channel => channel !== undefined)
}
