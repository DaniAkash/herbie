import { agents } from '@bun/modules/db/schema/agents.sql'
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Where each agent's thread has got to, and nothing else.
 *
 * The thread itself is jsonl in the agent's own folder. This row exists so the
 * rail can show an unread dot, and a screen can know how long a thread is,
 * without opening a file per agent on every paint.
 *
 * It is a cache of the files rather than a second source of truth. If the two
 * disagree the files win: they are what the append wrote.
 */
export const transcriptCursors = sqliteTable('transcript_cursors', {
  agentId: text('agent_id')
    .primaryKey()
    .references(() => agents.id, { onDelete: 'cascade' }),
  /** The sequence number of the last record written. */
  lastSeq: integer('last_seq').notNull().default(0),
  lastAt: text('last_at').notNull().default(sql`(current_timestamp)`),
  /**
   * The first record the person has not seen, or null when they are caught up.
   *
   * Set when a block is written while they are looking somewhere else, which
   * for an agent that works while nobody is watching is most of the time.
   */
  unreadFrom: integer('unread_from'),
})
