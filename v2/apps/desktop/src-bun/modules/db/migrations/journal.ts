import init from './0000_init_schema.sql' with { type: 'text' }
import agentUi from './0001_add_agent_ui_tables.sql' with { type: 'text' }
import agentConfig from './0002_add_agent_config.sql' with { type: 'text' }
import transcriptCursors from './0003_add_transcript_cursors.sql' with {
  type: 'text',
}
import retireMessages from './0004_retire_messages_for_transcript.sql' with {
  type: 'text',
}

export interface Migration {
  readonly name: string
  readonly sql: string
}

/**
 * Migrations in application order, embedded rather than read from disk.
 *
 * drizzle-kit still generates the `.sql` files and they stay the source of
 * truth, but the sidecar ships as a single compiled binary with no directory
 * to resolve against, so the contents travel inside it as text imports. A new
 * migration is appended here in the same commit that generates it.
 */
export const MIGRATIONS: readonly Migration[] = [
  { name: '0000_init_schema', sql: init },
  { name: '0001_add_agent_ui_tables', sql: agentUi },
  { name: '0002_add_agent_config', sql: agentConfig },
  { name: '0003_add_transcript_cursors', sql: transcriptCursors },
  { name: '0004_retire_messages_for_transcript', sql: retireMessages },
]
