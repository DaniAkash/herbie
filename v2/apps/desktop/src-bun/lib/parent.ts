import { createLogger } from '@bun/lib/log'

const log = createLogger('parent')

const EVERY_MS = 2000

/**
 * Exits when the process that spawned us goes away.
 *
 * The desktop shell kills this process on a graceful quit, but a crash or a
 * SIGKILL never runs that path, and an orphaned sidecar keeps the SQLite file
 * open and the port bound. The next launch then competes with a ghost.
 *
 * Watching the parent pid covers every death rather than only the polite ones:
 * when the parent goes, the OS reparents us to pid 1, which is the signal.
 * Closing stdin looked cleaner and does not fire under the shell's pipe.
 */
export function exitWithParent(): () => void {
  const started = process.ppid
  if (started <= 1) return () => {}

  const timer = setInterval(() => {
    if (process.ppid === started) return
    log.info('the process that started us is gone, stopping')
    clearInterval(timer)
    process.exit(0)
  }, EVERY_MS)

  // Do not hold the loop open on this alone.
  timer.unref?.()
  return () => clearInterval(timer)
}
