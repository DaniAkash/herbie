import { agents } from '@bun/modules/db/schema/agents.sql'
import { sql } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * A standing instruction, in the words the person used.
 *
 * Kept as a phrase rather than a matcher because it is read by the agent and
 * not by a rule engine. "post" means whatever the agent understands by post,
 * which is the point: a list of regular expressions would be precise about
 * the wrong thing.
 */
export const agentRules = sqliteTable('agent_rules', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  /** ask | allow */
  kind: text('kind').notNull(),
  phrase: text('phrase').notNull(),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
})
