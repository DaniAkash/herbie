import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * What a coding agent last told us about itself.
 *
 * Cached because a probe spawns the agent and waits on two round trips, and
 * the picker in the new agent flow must not do that every time it opens. A
 * stale row is shown immediately and refreshed behind it.
 */
export const runtimes = sqliteTable('runtimes', {
  /** The acpx agent id: claude, codex, gemini. */
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  /** installed | npx-available | not-installed */
  installState: text('install_state').notNull(),
  /** Whose change invalidates the cached probe, so it is stored beside it. */
  version: text('version'),
  installUrl: text('install_url').notNull().default(''),
  signedIn: integer('signed_in', { mode: 'boolean' }).notNull().default(false),
  supportsConfigOption: integer('supports_config_option', { mode: 'boolean' })
    .notNull()
    .default(false),
  /**
   * Json arrays. Three lists rather than one because they are not the same
   * list: `models` is what the agent advertises and may contain ids it will
   * refuse to be set to, `modelValues` is what setConfigOption accepts, and
   * an empty `modelValues` is what makes the picker disappear rather than
   * render a control the runtime will reject.
   */
  models: text('models').notNull().default('[]'),
  modelValues: text('model_values').notNull().default('[]'),
  efforts: text('efforts').notNull().default('[]'),
  probedAt: text('probed_at'),
  probeError: text('probe_error'),
})
