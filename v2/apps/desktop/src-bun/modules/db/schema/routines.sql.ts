import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { agents } from '@bun/modules/db/schema/agents.sql'

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
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastRunAt: text('last_run_at'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
})
