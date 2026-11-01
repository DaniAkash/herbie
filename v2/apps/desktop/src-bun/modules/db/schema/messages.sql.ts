import { agents } from '@bun/modules/db/schema/agents.sql'
import { sql } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * One conversation per agent, so a routine's output lands where you already
 * talk to it rather than in a separate inbox.
 */
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  /** agent | user | tool | divider */
  role: text('role').notNull(),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
})
