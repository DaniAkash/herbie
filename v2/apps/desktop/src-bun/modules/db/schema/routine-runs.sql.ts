import { agents } from '@bun/modules/db/schema/agents.sql'
import { routines } from '@bun/modules/db/schema/routines.sql'
import { sql } from 'drizzle-orm'
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

/**
 * One attempt at a routine, and the ledger the loop is durable through.
 *
 * A row is written before the turn it describes is started, so a process
 * killed at any point leaves a row naming exactly what was about to happen.
 * Recovery reads the ledger; nothing is recovered from memory.
 */
export const routineRuns = sqliteTable(
  'routine_runs',
  {
    id: text('id').primaryKey(),
    routineId: text('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),

    /**
     * Who asked for this, which decides what drains first.
     *
     * A person waiting on a reply should not sit behind a scheduled report,
     * so `person` sorts ahead of `routine`. Only `routine` is produced today;
     * the column exists from the start because adding it later means
     * rewriting the drain rather than extending it.
     */
    source: text('source').notNull().default('routine'),

    /** queued | running | done | failed | skipped */
    state: text('state').notNull().default('queued'),

    /**
     * The slot this run belongs to, not the moment it was noticed.
     *
     * Paired with the unique index below, this is what makes enqueueing
     * idempotent: a tick that runs twice across one minute inserts once.
     */
    dueAt: text('due_at').notNull(),

    claimedAt: text('claimed_at'),
    /** Renewed while the holder is genuinely working. A lapsed lease is reclaimable. */
    leaseUntil: text('lease_until'),
    /** What `startTurn` returned, so `turn.end` can be matched back to this row. */
    turnId: text('turn_id'),
    attempt: integer('attempt').notNull().default(0),
    error: text('error'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex('routine_runs_slot').on(table.routineId, table.dueAt),
  ],
)
