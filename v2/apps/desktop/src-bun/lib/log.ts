const LEVELS = ['debug', 'info', 'warn', 'error'] as const

type Level = (typeof LEVELS)[number]

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void
  info(message: string, fields?: Record<string, unknown>): void
  warn(message: string, fields?: Record<string, unknown>): void
  error(message: string, fields?: Record<string, unknown>): void
}

function threshold(name: string): number {
  const at = LEVELS.indexOf(name as Level)
  return at === -1 ? LEVELS.indexOf('info') : at
}

function format(fields: Record<string, unknown> | undefined): string {
  if (!fields) return ''
  const parts = Object.entries(fields).map(
    ([key, value]) => `${key}=${String(value)}`,
  )
  return parts.length === 0 ? '' : ` ${parts.join(' ')}`
}

/**
 * Logs go to stderr, and stderr only.
 *
 * stdout carries exactly one line for this process's whole life: the ready
 * line the desktop shell parses. Keeping logs off it means the shell never has
 * to guess which lines are a contract and which are prose, and a future
 * prettier log format cannot break the handshake.
 */
export function createLogger(scope: string, level = 'info'): Logger {
  const min = threshold(level)
  const write = (
    at: Level,
    message: string,
    fields?: Record<string, unknown>,
  ): void => {
    if (LEVELS.indexOf(at) < min) return
    process.stderr.write(`${at} ${scope}: ${message}${format(fields)}\n`)
  }
  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  }
}
