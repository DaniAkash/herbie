import type { Db } from '@bun/modules/db/db'

/** What the route tree needs from the process that built it. */
export interface Deps {
  readonly db: Db
  readonly databasePath: string
  /**
   * Where each agent's own folder is made.
   *
   * Passed in rather than read from the environment at the point of use, so
   * the one process decides it once at startup and a test can put it
   * somewhere disposable without reaching into process.env.
   */
  readonly agentsRoot: string
  readonly appliedMigrations: readonly string[]
  readonly startedAt: number
}
