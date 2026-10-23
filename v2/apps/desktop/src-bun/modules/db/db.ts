import { Database } from 'bun:sqlite'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { stateDir } from '@bun/lib/env'
import { createLogger } from '@bun/lib/log'
import { applyMigrations, pendingMigrations } from '@bun/modules/db/migrate'
import * as schema from '@bun/modules/db/schema/schema'
import { drizzle } from 'drizzle-orm/bun-sqlite'

const log = createLogger('db')

export type Db = ReturnType<typeof drizzle<typeof schema>>

export interface DbHandle {
  /** The underlying connection, for pragmas and the migration path. */
  readonly sqlite: Database
  readonly db: Db
  readonly path: string
}

export function databasePath(): string {
  return join(stateDir(), 'herbie.sqlite')
}

/**
 * A consistent copy, taken with VACUUM INTO rather than a file copy.
 *
 * WAL keeps recent commits in a sidecar file, so copying only the main
 * database can produce a backup that is missing the newest writes.
 */
function backup(sqlite: Database, to: string): void {
  rmSync(to, { force: true })
  sqlite.exec(`VACUUM INTO '${to.replace(/'/g, "''")}'`)
}

/**
 * Opens the database and brings it up to the current schema.
 *
 * The backup is taken only when there is pending work, so a normal launch does
 * not copy the file on every start. WAL is set before anything else touches
 * the connection, because a reader during a write is the common case here: the
 * agent loop writes while the window reads.
 */
export function openDb(path = databasePath()): DbHandle {
  // The directory of the file being opened, not the state directory: a caller
  // that passes a path elsewhere, which every test does, must not have the
  // real install directory created underneath it as a side effect.
  mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path, { create: true })
  sqlite.exec('PRAGMA journal_mode = WAL')
  sqlite.exec('PRAGMA foreign_keys = ON')
  sqlite.exec('PRAGMA busy_timeout = 5000')

  if (pendingMigrations(sqlite).length > 0) {
    backup(sqlite, `${path}.backup`)
    const names = applyMigrations(sqlite)
    log.info('migrations applied', {
      count: names.length,
      last: names.at(-1) ?? 'none',
    })
  }

  return { sqlite, db: drizzle(sqlite, { schema }), path }
}
