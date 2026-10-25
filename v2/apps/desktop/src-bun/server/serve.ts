import { logLevelName } from '@bun/lib/env'
import { createLogger } from '@bun/lib/log'
import { exitWithParent } from '@bun/lib/parent'
import type { ReadyLine } from '@bun/shared/index'
import type { Hono } from 'hono'

const log = createLogger('server', logLevelName())

export interface ServerHandle {
  readonly port: number
  readonly token: string
}

let running: ReturnType<typeof Bun.serve> | null = null

function authorised(request: Request, token: string): boolean {
  return request.headers.get('authorization') === `Bearer ${token}`
}

/**
 * Serves the API.
 *
 * Port 0 asks the OS for a free port and the caller reads the real one back. A
 * desktop app must not squat a fixed port, and choosing one up front races:
 * another process can take it between the check and the bind.
 *
 * The token is required by every route except health, and it is not optional.
 * This process drives coding agents with filesystem access and any local
 * process can reach 127.0.0.1, so an unauthenticated localhost port is a real
 * hole rather than a theoretical one. Callers that have no token generate one
 * rather than passing nothing, so there is no code path that serves openly.
 */
export function startServer(
  app: Pick<Hono, 'fetch'>,
  port: number,
  token: string,
): ServerHandle {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    idleTimeout: 0,
    fetch: (request) => {
      const url = new URL(request.url)
      if (!url.pathname.startsWith('/api')) {
        return new Response('herbie api\n', { status: 404 })
      }
      if (url.pathname !== '/api/health' && !authorised(request, token)) {
        return new Response('unauthorised\n', { status: 401 })
      }
      return app.fetch(request)
    },
  })

  // Bun types the port as optional because a unix socket server has none. This
  // one always binds TCP, so an absent port is a broken assumption rather than
  // a case to handle quietly.
  const bound = server.port
  if (bound === undefined) throw new Error('server bound without a port')

  log.info('api ready', { url: `http://127.0.0.1:${bound}` })
  running = server
  return { port: bound, token }
}

export function stopServer(): void {
  running?.stop(true)
  running = null
}

/**
 * The line the desktop shell parses on stdout to learn where to connect.
 *
 * Written rather than logged so it is a contract instead of a log format that
 * someone later makes prettier. It is also the only thing this process ever
 * puts on stdout; logs go to stderr.
 */
function announceReady(handle: ServerHandle): void {
  const line: ReadyLine = { ready: true, port: handle.port, pid: process.pid }
  process.stdout.write(`${JSON.stringify(line)}\n`)
}

/**
 * Brings the api up and says so, for whoever is listening.
 *
 * Takes the port and token rather than reading the command line, because this
 * is the module that owns the socket and not the one that owns the arguments.
 * A given port means the desktop shell spawned this, which is also what makes
 * the process follow its parent out.
 */
export function startApi(input: {
  app: Pick<Hono, 'fetch'>
  defaultPort: number
  port?: string | undefined
  token: string
}): ServerHandle {
  if (input.port !== undefined) {
    exitWithParent()
  }
  const handle = startServer(
    input.app,
    input.port === undefined ? input.defaultPort : Number(input.port),
    input.token,
  )
  announceReady(handle)
  return handle
}
