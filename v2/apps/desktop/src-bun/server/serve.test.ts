import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '@bun/modules/db/db'
import { appliedMigrations } from '@bun/modules/db/migrate'
import { createApp } from '@bun/server/app'
import { startServer, stopServer } from '@bun/server/serve'

let dir: string

function serve(token = 'a-secret') {
  const { db, sqlite, path } = openDb(join(dir, 'herbie.sqlite'))
  const app = createApp({
    db,
    databasePath: path,
    appliedMigrations: appliedMigrations(sqlite),
    startedAt: Date.now(),
  })
  return startServer(app, 0, token)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'herbie-api-'))
})

afterEach(() => {
  stopServer()
  rmSync(dir, { recursive: true, force: true })
})

describe('the api', () => {
  test('binds a port the OS chose rather than the one asked for', () => {
    expect(serve().port).toBeGreaterThan(0)
  })

  test('answers health without a token, so a wrong token is distinguishable from a dead sidecar', async () => {
    const { port } = serve('a-secret')
    const response = await fetch(`http://127.0.0.1:${port}/api/health`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok' })
  })

  test('refuses every other route without the bearer token', async () => {
    const { port } = serve('a-secret')
    expect((await fetch(`http://127.0.0.1:${port}/api/status`)).status).toBe(
      401,
    )
  })

  test('serves status once the bearer token matches', async () => {
    const { port } = serve('a-secret')
    const response = await fetch(`http://127.0.0.1:${port}/api/status`, {
      headers: { authorization: 'Bearer a-secret' },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      agentCount: 0,
      migrations: ['0000_init_schema'],
    })
  })

  /**
   * The regression this guards: the token used to be optional all the way
   * down, so a run with no --token served every route openly.
   */
  test('mints a token when nothing passed one, so a bare run is never open', async () => {
    const entry = join(import.meta.dir, '..', 'index.ts')
    const child = Bun.spawn([process.execPath, entry, '--port', '0'], {
      env: { HERBIE_STATE_DIR: dir, HERBIE_LOG_LEVEL: 'error' },
      stdout: 'pipe',
      stderr: 'ignore',
    })
    try {
      // Only the first line, because the process stays up: reading the
      // whole stream would wait for an exit that never comes.
      const reader = child.stdout.getReader()
      let text = ''
      while (!text.includes('\n')) {
        const { value, done } = await reader.read()
        if (done) break
        text += new TextDecoder().decode(value)
      }
      const { port } = JSON.parse(text.split('\n')[0] ?? '{}') as {
        port: number
      }
      expect(port).toBeGreaterThan(0)
      expect((await fetch(`http://127.0.0.1:${port}/api/status`)).status).toBe(
        401,
      )
    } finally {
      child.kill()
    }
  })

  test('does not serve anything outside /api', async () => {
    const { port } = serve()

    expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(404)
  })
})
