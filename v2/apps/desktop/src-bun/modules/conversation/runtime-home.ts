import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createLogger } from '@bun/lib/log'

const log = createLogger('runtime-home')

/**
 * A config directory of its own, per assistant.
 *
 * An assistant you just created should start as itself, not as a copy of
 * whatever the person has installed globally. Pointing the coding agent at
 * its own home is what makes that true: no inherited plugins, skills, MCP
 * servers or marketplaces, and settings Herbie chooses rather than inherits.
 *
 * The one thing that must carry over is the login. `auth.json` is symlinked
 * back to the real home rather than copied, so a token refresh on either side
 * is seen by both and nobody's credentials are duplicated onto disk.
 */

export interface RuntimeHome {
  /** Environment for the agent process, or nothing when unsupported. */
  readonly env: Record<string, string>
}

/**
 * `approvals_reviewer` is asked for, and does not currently win.
 *
 * Codex's auto-review hands each escalation to a separate reviewer agent
 * rather than to the client, which is wrong here twice over: Herbie already
 * has a permission surface that the reviewer silently replaces, and the
 * reviewer is a model call per action. Measured on one research turn it was
 * 206 seconds out of 248.
 *
 * `user` is the documented default, but this file does not decide it.
 * `@agentclientprotocol/codex-acp` picks an ACP session mode, and its `agent`
 * mode hardcodes `approvals_reviewer: auto_review` alongside
 * `approval_policy: on-request`, applied after config is read. Verified by
 * running a turn with this file in place: the reviewer still fired.
 *
 * The lever is `session/set_mode` to a mode whose reviewer is `user`, which
 * acpx exposes as `AcpRuntime.setMode` and the provider does not surface.
 * The line stays because it is correct and costs nothing, and it takes effect
 * the moment the mode stops being forced over it.
 */
const CODEX_CONFIG = `# Written by Herbie. Edits are overwritten.
#
# This assistant has its own home so it starts clean: no plugins, skills,
# MCP servers or marketplaces inherited from the machine.
#
# Asked for, but currently overridden by the ACP adapter's session mode.
approvals_reviewer = "user"
`

/**
 * Prepares the home and gives back the environment that points at it.
 *
 * Only codex is handled today. A runtime with no entry here gets no override
 * and keeps inheriting the machine's configuration, which is the honest
 * outcome rather than guessing at a layout and breaking its auth.
 */
export function runtimeHome(
  acpAgent: string,
  workspaceDir: string,
): RuntimeHome {
  if (acpAgent !== 'codex') return { env: {} }

  const home = join(workspaceDir, '.herbie', 'codex')
  try {
    mkdirSync(home, { recursive: true })
    writeFileSync(join(home, 'config.toml'), CODEX_CONFIG, 'utf8')
    linkAuth(home)
    return { env: { CODEX_HOME: home } }
  } catch (cause) {
    // An agent that runs with the machine's config is worse than one with its
    // own, and far better than one that cannot start. Inheriting is the
    // fallback, and it is said out loud rather than failing quietly.
    log.warn('could not prepare a private home, inheriting the machine', {
      agent: acpAgent,
      cause: String(cause),
    })
    return { env: {} }
  }
}

/**
 * Points the private home at the real credentials.
 *
 * Symlinked rather than copied: a refreshed token has to be visible to both,
 * and a second copy of someone's credentials on disk is a thing to avoid
 * creating rather than a convenience.
 */
function linkAuth(home: string): void {
  const real = join(homedir(), '.codex', 'auth.json')
  try {
    symlinkSync(real, join(home, 'auth.json'))
  } catch (cause) {
    // Already linked from a previous run, which is the common case.
    if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause
  }
}
