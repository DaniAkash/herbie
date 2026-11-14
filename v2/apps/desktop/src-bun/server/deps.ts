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
  /** Where skill bundles live, shared by every agent that links one. */
  readonly skillsWorkspace: string
  /**
   * Clears a parked agent, for the one caller who can know it is fixed.
   *
   * The loop parks an agent that keeps failing and nothing times that out,
   * because recovering on a clock would simply park again on the next
   * failure. Turning a routine back on is the person saying they dealt with
   * the cause, so that is where this is called from.
   */
  readonly revive?: (agentId: string) => void
  /**
   * Re-reads which agents are worth watching.
   *
   * The notification watch set is built from the enabled agents, so creating,
   * switching or deleting one has to be followed by a rebuild. Optional for
   * the same reason `revive` is: a test builds the tree without a loop.
   */
  readonly notifyRefresh?: () => void
  readonly appliedMigrations: readonly string[]
  readonly startedAt: number
}
