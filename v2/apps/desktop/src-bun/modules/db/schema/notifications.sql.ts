import { agents } from '@bun/modules/db/schema/agents.sql'
import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Everything worth telling the person, whether or not a banner was drawn.
 *
 * The row is written before any channel is asked to deliver it, so a denied
 * operating system permission degrades the feature to a list rather than
 * silencing it. That is also what makes this the inbox: the banner is one
 * channel reading these rows, not the thing that produces them.
 */
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    /** Which flavour of `needs_you` this is, and null for every other kind. */
    reason: text('reason'),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    turnId: text('turn_id'),

    /**
     * The agent, so one agent holds one live notification.
     *
     * Collapsing on the subject rather than on the event is what makes a
     * banner answer "how is this agent doing right now" instead of stacking
     * a history nobody reads.
     */
    collapseKey: text('collapse_key').notNull(),

    title: text('title').notNull(),
    body: text('body').notNull(),
    /** Where clicking it should land, which is that agent's thread. */
    route: text('route').notNull(),

    /**
     * How many events this row has swallowed since it was last seen.
     *
     * Replacement is lossy, so without a count three events collapsed into
     * one banner look exactly like one event. Cleared on every path where
     * the person demonstrably saw it, not only on dismissal.
     */
    updates: integer('updates').notNull().default(0),

    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
    deliveredAt: text('delivered_at'),
    seenAt: text('seen_at'),
    dismissedAt: text('dismissed_at'),
    /** Which channels were asked, and what each one said. */
    channels: text('channels').notNull().default('{}'),
  },
  (table) => [
    index('notifications_agent').on(table.agentId, table.createdAt),
    index('notifications_seen').on(table.seenAt),
  ],
)
