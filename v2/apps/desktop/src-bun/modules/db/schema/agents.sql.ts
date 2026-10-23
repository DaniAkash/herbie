import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * The agent registry.
 *
 * Each agent gets its own workspace directory, so two agents editing the same
 * repository cannot fight over a working tree. `acpAgent` names which coding
 * agent backs it, which is the only part the sidecar hands to acpx.
 */
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  acpAgent: text('acp_agent').notNull(),
  workspaceDir: text('workspace_dir').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
})
