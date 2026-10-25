import type { Database } from 'bun:sqlite'
import { MIGRATIONS, type Migration } from '@bun/modules/db/migrations/journal'

const LEDGER = '__herbie_migrations'

/** Statements inside one generated migration are separated by this marker. */
const BREAKPOINT = '--> statement-breakpoint'

function hasLedger(db: Database): boolean {
  const row = db
    .query<{ name: string }, []>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${LEDGER}'`,
    )
    .get()
  return row !== null
}

function applied(db: Database): Set<string> {
  if (!hasLedger(db)) return new Set()
  const rows = db
    .query<{ name: string }, []>(`SELECT name FROM ${LEDGER}`)
    .all()
  return new Set(rows.map((row) => row.name))
}

/** Migrations this database has not applied yet, in order. */
export function pendingMigrations(db: Database): readonly Migration[] {
  const done = applied(db)
  return MIGRATIONS.filter((migration) => !done.has(migration.name))
}

export function appliedMigrations(db: Database): readonly string[] {
  return [...applied(db)].sort()
}

/**
 * Applies the pending migrations, each one inside a transaction.
 *
 * The ledger is created here rather than at open time, so a caller can check
 * for pending work and take a backup first without that check being the thing
 * that writes a table into the snapshot.
 */
export function applyMigrations(db: Database): readonly string[] {
  const pending = pendingMigrations(db)
  if (pending.length === 0) return []

  db.exec(
    `CREATE TABLE IF NOT EXISTS ${LEDGER} (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  )

  for (const migration of pending) {
    const statements = migration.sql
      .split(BREAKPOINT)
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0)

    db.transaction(() => {
      for (const statement of statements) db.exec(statement)
      db.query(`INSERT INTO ${LEDGER} (name, applied_at) VALUES (?, ?)`).run(
        migration.name,
        new Date().toISOString(),
      )
    })()
  }

  return pending.map((migration) => migration.name)
}
