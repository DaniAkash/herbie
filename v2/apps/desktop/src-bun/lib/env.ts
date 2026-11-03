import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Whether this is a development build.
 *
 * The desktop shell passes the flag under `debug_assertions`; a terminal run
 * sets the environment variable instead. Both are read here rather than at the
 * two call sites, so the window, the vite proxy and the seed script can never
 * disagree about which install they are looking at.
 */
export function isDev(): boolean {
  return process.argv.includes('--dev') || process.env.HERBIE_DEV === '1'
}

/**
 * Where Herbie keeps its database and its agents' workspaces.
 *
 * A dev build is kept out of the release directory entirely, which is the only
 * separation that matters: the two installs are never both writing one file.
 * The override comes first and exists for tests, which must never touch a real
 * install.
 */
export function stateDir(): string {
  const override = process.env.HERBIE_STATE_DIR
  if (override) return override
  return join(homedir(), isDev() ? '.herbie-dev' : '.herbie')
}

/**
 * One agent's own working tree.
 *
 * Per agent rather than shared, so two agents editing the same repository
 * cannot fight over a working tree, and so a tool linked for one of them is
 * written somewhere that belongs to it alone.
 */
export function agentsDir(): string {
  return join(stateDir(), 'agents')
}

export function agentDir(id: string): string {
  return join(agentsDir(), id)
}

/** Log verbosity, from the environment rather than from settings. */
export function logLevelName(): string {
  return process.env.HERBIE_LOG_LEVEL ?? 'info'
}

/**
 * Where a self-started sidecar leaves its token for the vite proxy.
 *
 * Only written when nothing handed us one. A token from the desktop shell
 * reaches the webview over ipc and never needs to touch the disk.
 */
export function tokenPath(): string {
  return join(stateDir(), 'api-token')
}
