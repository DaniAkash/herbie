import type { Db } from '@bun/modules/db/db'
import { notifications } from '@bun/modules/db/schema/schema'
import type { ChannelId } from '@bun/modules/notifications/decide'
import type {
  NeedsYouReason,
  NotifyKind,
} from '@bun/modules/notifications/events'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

/**
 * The rows behind the inbox, and the one place the update counter moves.
 *
 * A row is written before any channel is asked to deliver, so a notification
 * the operating system swallowed is still a thing the person can find.
 */

export interface StoredNotification {
  readonly id: string
  readonly kind: string
  readonly reason: string | null
  readonly agentId: string
  readonly turnId: string | null
  readonly collapseKey: string
  readonly title: string
  readonly body: string
  readonly route: string
  readonly updates: number
  readonly createdAt: string
  readonly deliveredAt: string | null
  readonly seenAt: string | null
  readonly dismissedAt: string | null
  readonly channels: string
}

export interface NotificationDraft {
  readonly kind: NotifyKind
  readonly reason: NeedsYouReason | null
  readonly agentId: string
  readonly turnId: string | null
  readonly collapseKey: string
  readonly title: string
  readonly body: string
  readonly route: string
}

function notificationId(): string {
  const stamp = Date.now().toString(36)
  return `nt_${stamp}${Math.random().toString(36).slice(2, 6)}`
}

/** Neither seen nor dismissed, which is the one row a collapse key may hold. */
function live(agentId: string) {
  return and(
    eq(notifications.agentId, agentId),
    isNull(notifications.seenAt),
    isNull(notifications.dismissedAt),
  )
}

/**
 * Writes the event, replacing this agent's live row rather than stacking.
 *
 * The replacement carries a count because collapsing is lossy: without it,
 * three events swallowed into one row look exactly like one event.
 */
export function record(db: Db, draft: NotificationDraft): StoredNotification {
  const existing = db
    .select()
    .from(notifications)
    .where(
      and(
        live(draft.agentId),
        eq(notifications.collapseKey, draft.collapseKey),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .get()

  if (existing) {
    return db
      .update(notifications)
      .set({
        kind: draft.kind,
        reason: draft.reason,
        turnId: draft.turnId,
        title: draft.title,
        body: draft.body,
        route: draft.route,
        updates: existing.updates + 1,
        deliveredAt: null,
        createdAt: sql`(current_timestamp)`,
      })
      .where(eq(notifications.id, existing.id))
      .returning()
      .get()
  }

  return db
    .insert(notifications)
    .values({
      id: notificationId(),
      kind: draft.kind,
      reason: draft.reason,
      agentId: draft.agentId,
      turnId: draft.turnId,
      collapseKey: draft.collapseKey,
      title: draft.title,
      body: draft.body,
      route: draft.route,
    })
    .returning()
    .get()
}

export function markDelivered(
  db: Db,
  id: string,
  results: Readonly<Record<ChannelId, string>>,
): void {
  db.update(notifications)
    .set({
      deliveredAt: sql`(current_timestamp)`,
      channels: JSON.stringify(results),
    })
    .where(eq(notifications.id, id))
    .run()
}

/**
 * The person looked at it, by whatever route.
 *
 * Every seen path clears the counter, not only dismissal. agent-terminal
 * shipped the version that cleared on one path and the next notification
 * then overstated its own history; it is spelled out here so that bug is not
 * written twice.
 */
export function markSeen(db: Db, id: string): void {
  db.update(notifications)
    .set({ seenAt: sql`(current_timestamp)`, updates: 0 })
    .where(and(eq(notifications.id, id), isNull(notifications.seenAt)))
    .run()
}

export function markDismissed(db: Db, id: string): void {
  db.update(notifications)
    .set({
      dismissedAt: sql`(current_timestamp)`,
      seenAt: sql`coalesce(${notifications.seenAt}, current_timestamp)`,
      updates: 0,
    })
    .where(eq(notifications.id, id))
    .run()
}

/** The person opened that agent's thread, which is the strongest seen signal. */
export function seeAgent(db: Db, agentId: string): void {
  db.update(notifications)
    .set({ seenAt: sql`(current_timestamp)`, updates: 0 })
    .where(live(agentId))
    .run()
}

/**
 * The agent moved on, so what the row said is no longer true.
 *
 * Withdrawing is not the person seeing it, but it ends the row's life the
 * same way, and leaving the counter set would carry a stale history into the
 * next notification for that agent.
 */
export function withdrawAgent(db: Db, agentId: string): void {
  db.update(notifications)
    .set({ dismissedAt: sql`(current_timestamp)`, updates: 0 })
    .where(live(agentId))
    .run()
}

export function listNotifications(
  db: Db,
  limit = 50,
): readonly StoredNotification[] {
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all()
}

/** What the dock badge counts: agents waiting, not events. */
export function unseenAgents(db: Db): readonly string[] {
  const rows = db
    .selectDistinct({ agentId: notifications.agentId })
    .from(notifications)
    .where(and(isNull(notifications.seenAt), isNull(notifications.dismissedAt)))
    .all()
  return rows.map((row) => row.agentId)
}
