import { agents } from '@bun/modules/db/schema/agents.sql'
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Work an agent starts by itself.
 *
 * `kind` is how it fires. A cron slot and an inbound event enqueue the same
 * way once they fire, so they differ only here and in how they read.
 */
export const routines = sqliteTable('routines', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** schedule | event */
  kind: text('kind').notNull().default('schedule'),
  /** Plain language, as it reads in the panel. */
  cadence: text('cadence').notNull(),
  /**
   * The cadence as a cron expression, or null when it did not parse.
   *
   * Both are kept because they answer different questions: the cadence is
   * what the person wrote and still edits, the cron is what a scheduler can
   * act on. Deriving one from the other at read time would mean parsing on
   * every row, and parsing is where a routine silently stops firing.
   */
  cron: text('cron'),
  /** What the agent is actually asked to do when this fires. */
  prompt: text('prompt').notNull().default(''),
  /** Send the result to Telegram as well as the conversation. */
  deliverTelegram: integer('deliver_telegram', { mode: 'boolean' })
    .notNull()
    .default(false),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastRunAt: text('last_run_at'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
})
