import type { StoredNotification } from '@bun/modules/notifications/store'

/**
 * The app wide channel, which the per agent bus cannot be.
 *
 * The conversation bus is keyed by agent and the route that reads it is open
 * only for the agent on screen, so a background agent is invisible to the
 * window. Everything this module has to say is about an agent the person is
 * by definition not looking at, which is why it needs a channel of its own.
 */

export type AppSignal =
  | { readonly type: 'notification'; readonly notification: StoredNotification }
  | { readonly type: 'withdraw'; readonly agentId: string }
  | {
      readonly type: 'attention'
      readonly agentId: string
      readonly state: string
    }

export type AppListener = (signal: AppSignal) => void

const listeners = new Set<AppListener>()

export function subscribeApp(listener: AppListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function publishApp(signal: AppSignal): void {
  for (const listener of listeners) {
    try {
      listener(signal)
    } catch {
      // A connection that went away mid write. Its abort handler removes it.
    }
  }
}

/** Whether anything is listening, which is how the desktop channel degrades. */
export function appWatcherCount(): number {
  return listeners.size
}
