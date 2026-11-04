import { agents } from '@bun/modules/db/schema/agents.sql'
import { sql } from 'drizzle-orm'
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

/**
 * An MCP server, defined once and shared.
 *
 * `kind` is stdio or http. A stdio server carries a command and arguments, an
 * http one carries a url. Both shapes live in one table because the UI edits
 * them through one form.
 */
export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('stdio'),
  /** The command for stdio, the url for http. */
  target: text('target').notNull(),
  args: text('args').notNull().default(''),
  /** running | failed */
  status: text('status').notNull().default('running'),
})

/** A markdown instruction file an agent can load on demand. */
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
})

/**
 * Which agent may reach which server or skill.
 *
 * Servers and skills are common; the switch is per agent, so a row here is
 * the only thing that differs between two agents looking at the same library.
 */
export const agentTools = sqliteTable(
  'agent_tools',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    /** server | skill */
    kind: text('kind').notNull(),
    refId: text('ref_id').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
  },
  // One row per switch, which this table had no way to say before. Flipping a
  // switch is an upsert, and an upsert without something to conflict on just
  // appends: the second flip leaves two rows for one switch and the next read
  // picks whichever comes back first.
  (table) => [
    uniqueIndex('agent_tools_agent_kind_ref').on(
      table.agentId,
      table.kind,
      table.refId,
    ),
  ],
)
