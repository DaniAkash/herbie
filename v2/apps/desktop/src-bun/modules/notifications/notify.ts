import { createLogger } from '@bun/lib/log'
import { type Signal, subscribe } from '@bun/modules/conversation/bus'
import type { Db } from '@bun/modules/db/db'
import { agents } from '@bun/modules/db/schema/schema'
import { desktopChannel } from '@bun/modules/notifications/channels/desktop'
import { inboxChannel } from '@bun/modules/notifications/channels/inbox'
import {
  channelsFor,
  registerChannel,
} from '@bun/modules/notifications/channels/registry'
import { bodyFor, routeFor, titleFor } from '@bun/modules/notifications/copy'
import {
  type ChannelId,
  decide,
  recordsAnyway,
  type SuppressReason,
} from '@bun/modules/notifications/decide'
import type {
  AttentionState,
  NotifyEvent,
} from '@bun/modules/notifications/events'
import { readPrefs } from '@bun/modules/notifications/prefs'
import { currentPresence } from '@bun/modules/notifications/presence'
import {
  parkEvent,
  read,
  type TurnClock,
} from '@bun/modules/notifications/state'
import {
  markDelivered,
  record,
  type StoredNotification,
  withdrawAgent,
} from '@bun/modules/notifications/store'
import { publishApp } from '@bun/modules/notifications/stream'
import type { TranscriptRecord } from '@bun/shared/transcript'
import { eq } from 'drizzle-orm'

const log = createLogger('notify')

/**
 * The part with the side effects, kept to one file so the order is readable.
 *
 * It watches every enabled agent rather than only the ones something handed
 * work to, because the whole point of this module is the agent nobody is
 * looking at.
 */

export interface Notifications {
  stop: () => void
  /** Picks up agents created, enabled, disabled or deleted since the last call. */
  refresh: () => void
  /** The breaker giving up, which reaches no bus and has to be handed in. */
  parked: (agentId: string) => void
}

/**
 * Never logs the title or the body.
 *
 * Both are whatever the agent wrote, and a log file is the one artefact
 * people paste into issues without reading.
 */
function drop(event: NotifyEvent, because: SuppressReason): void {
  log.debug('not interrupting', {
    agent: event.agentId,
    kind: event.kind,
    because,
  })
}

async function deliver(
  db: Db,
  notification: StoredNotification,
  ids: readonly ChannelId[],
): Promise<void> {
  const results: Partial<Record<ChannelId, string>> = {}
  for (const channel of channelsFor(ids)) {
    try {
      const outcome = await channel.deliver(notification)
      results[channel.id] = outcome.ok ? 'ok' : outcome.reason
    } catch (cause) {
      // One channel failing must not stop the next. The row is written
      // already, so the person can still find this whatever happened here.
      results[channel.id] = 'threw'
      log.warn('a channel failed', {
        channel: channel.id,
        cause: String(cause),
      })
    }
  }
  markDelivered(db, notification.id, results as Record<ChannelId, string>)
}

export function startNotifications(db: Db): Notifications {
  registerChannel(inboxChannel)
  registerChannel(desktopChannel)

  const attention = new Map<string, AttentionState>()
  const clocks = new Map<string, TurnClock>()
  const watchers = new Map<string, () => void>()

  const attentionOf = (agentId: string): AttentionState =>
    attention.get(agentId) ?? 'idle'

  const titleOf = (agentId: string): string => {
    const row = db.select().from(agents).where(eq(agents.id, agentId)).get()
    return row ? titleFor(row.name, row.workspaceDir) : agentId
  }

  const write = (event: NotifyEvent): StoredNotification =>
    record(db, {
      kind: event.kind,
      reason: event.kind === 'needs_you' ? event.reason : null,
      agentId: event.agentId,
      turnId: event.turnId,
      collapseKey: event.agentId,
      title: titleOf(event.agentId),
      body: bodyFor(event),
      route: routeFor(event),
    })

  /**
   * Re-reads the world immediately before the channels are asked.
   *
   * This is the rule a later refactor is most likely to delete as redundant.
   * It is not: one comparison covers the person having answered in another
   * window, the agent having moved on, the question having been superseded
   * and the turn having been cancelled. Dropped rather than queued, because
   * a banner about a state that has already changed is worse than none.
   */
  const stillTrue = (event: NotifyEvent): boolean =>
    attentionOf(event.agentId) === event.becomes &&
    !(
      currentPresence(Date.now()).focused &&
      currentPresence(Date.now()).agentId === event.agentId
    )

  const consider = (event: NotifyEvent, previous: AttentionState): void => {
    const decision = decide(
      event,
      currentPresence(Date.now()),
      previous,
      readPrefs(db),
    )

    if (!decision.fire) {
      drop(event, decision.because)
      if (!recordsAnyway(decision.because)) return
      void deliver(db, write(event), ['inbox'])
      return
    }

    if (!stillTrue(event)) {
      drop(event, 'no_longer_true')
      return
    }
    void deliver(db, write(event), decision.channels)
  }

  const onRecord = (agentId: string, entry: TranscriptRecord): void => {
    const at = Date.now()

    if (entry.kind === 'turn.start') {
      clocks.set(agentId, { turnId: entry.turn, startedAt: at })
    }

    const previous = attentionOf(agentId)
    const reading = read(entry, agentId, clocks.get(agentId) ?? null, at)
    attention.set(agentId, reading.becomes)

    if (reading.becomes !== previous) {
      publishApp({ type: 'attention', agentId, state: reading.becomes })
    }

    // The person answered, so what was on screen about this agent is no
    // longer true. Withdrawing is the other half of the awaiting state.
    if (previous === 'awaiting' && reading.becomes !== 'awaiting') {
      withdrawAgent(db, agentId)
      publishApp({ type: 'withdraw', agentId })
    }

    if (reading.event) consider(reading.event, previous)
  }

  const watch = (agentId: string): (() => void) =>
    subscribe(agentId, (signal: Signal) => {
      if (signal.type !== 'record') return
      onRecord(agentId, signal.record)
    })

  const refresh = (): void => {
    const enabled = new Set(
      db
        .select()
        .from(agents)
        .where(eq(agents.enabled, true))
        .all()
        .map((row) => row.id),
    )

    for (const [agentId, off] of watchers) {
      if (enabled.has(agentId)) continue
      off()
      watchers.delete(agentId)
      attention.delete(agentId)
      clocks.delete(agentId)
    }
    for (const agentId of enabled) {
      if (!watchers.has(agentId)) watchers.set(agentId, watch(agentId))
    }
  }

  refresh()

  return {
    stop: () => {
      for (const off of watchers.values()) off()
      watchers.clear()
    },
    refresh,
    parked: (agentId: string) => {
      const previous = attentionOf(agentId)
      attention.set(agentId, 'failed')
      consider(parkEvent(agentId), previous)
    },
  }
}
