import { chmodSync, writeFileSync } from 'node:fs'
import { agentsDir, logLevelName, skillsDir, tokenPath } from '@bun/lib/env'
import { createLogger } from '@bun/lib/log'
import { openDb } from '@bun/modules/db/db'
import { ensureInstalledAt } from '@bun/modules/db/install'
import { appliedMigrations } from '@bun/modules/db/migrate'
import { startLoop } from '@bun/modules/loop/loop'
import { startNotifications } from '@bun/modules/notifications/notify'
import { createApp } from '@bun/server/app'
import { startApi, stopServer } from '@bun/server/serve'

const log = createLogger('herbie', logLevelName())

/** The port used when nothing spawned us, so a terminal run is predictable. */
const DEFAULT_PORT = 4576

/**
 * Reads a flag the desktop shell passes when it spawns this process.
 *
 * The shell owns the port and the token so every launch gets a fresh pair.
 * Falling back to a default keeps the terminal path working with no shell
 * present, which is the property this whole layout protects: the sidecar is a
 * program, not a subroutine of the window.
 */
function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? undefined : process.argv[at + 1]
}

function main(): void {
  const startedAt = Date.now()
  const { db, sqlite, path } = openDb()
  ensureInstalledAt(db)

  // Watching starts before the loop, so a routine the first tick starts has
  // somebody subscribed to its agent already.
  const notifications = startNotifications(db)

  // Built before the routes so they can reach it, and safe to build here:
  // the first tick is a full interval away, so nothing runs before the API
  // is listening to publish it to.
  const loop = startLoop(db, { onPark: (id) => notifications.parked(id) })

  const app = createApp({
    db,
    revive: (agentId) => loop.revive(agentId),
    notifyRefresh: () => notifications.refresh(),
    databasePath: path,
    agentsRoot: agentsDir(),
    skillsWorkspace: skillsDir(),
    appliedMigrations: appliedMigrations(sqlite),
    startedAt,
  })

  // A run with no shell still gets a token. Serving openly because an
  // argument was missing is the one failure mode worth designing out: this
  // process drives coding agents with filesystem access, and any local
  // process can reach 127.0.0.1.
  const given = flag('token')
  const token = given ?? crypto.randomUUID()
  if (given === undefined) {
    // Left where the vite proxy can find it, so the browser development path
    // works without copying a token by hand. Owner-only, next to the database
    // it protects. chmod as well as the create mode, because the mode is
    // ignored when the file is already there from a previous run.
    const path = tokenPath()
    writeFileSync(path, token, { mode: 0o600 })
    chmodSync(path, 0o600)
    log.info('no token given, generated one', { path })
  }

  startApi({ app, defaultPort: DEFAULT_PORT, port: flag('port'), token })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      log.info(`${signal} received, stopping`)
      // Best effort. The ledger is the durability guarantee, not this path:
      // a run claimed and never settled is requeued on the next boot.
      loop.stop()
      notifications.stop()
      stopServer()
      sqlite.close()
      process.exit(0)
    })
  }
}

main()
