import type { Db } from '@bun/modules/db/db'

/** What the route tree needs from the process that built it. */
export interface Deps {
  readonly db: Db
  readonly databasePath: string
  readonly appliedMigrations: readonly string[]
  readonly startedAt: number
}
