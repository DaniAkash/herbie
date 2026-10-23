import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Where Herbie keeps its database and workspaces.
 *
 * Deliberately not `~/.herbie`, which the pre-Tauri app owns. The two will be
 * installed side by side for as long as this rewrite takes, and pointing both
 * at one directory means two schema chains over one file. The override exists
 * for tests, which must never touch a real install.
 */
export function stateDir(): string {
  return process.env.HERBIE_STATE_DIR ?? join(homedir(), '.herbie-v2')
}

/** Log verbosity, from the environment rather than from settings. */
export function logLevelName(): string {
  return process.env.HERBIE_LOG_LEVEL ?? 'info'
}
