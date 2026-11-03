import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '@bun/modules/db/db'
import { appliedMigrations } from '@bun/modules/db/migrate'
import { createApp } from '@bun/server/app'

let dir: string
let app: ReturnType<typeof createApp>

const DRAFT = {
  name: 'Reader',
  color: 'post',
  brief: 'You read my newsletters each morning.',
  acpAgent: 'claude',
  model: 'opus',
  effort: 'medium',
}

function post(path: string, json: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(json),
  })
}

function patch(path: string, json: unknown) {
  return app.request(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(json),
  })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'herbie-writes-'))
  const { db, sqlite, path } = openDb(join(dir, 'herbie.sqlite'))
  app = createApp({
    db,
    databasePath: path,
    agentsRoot: join(dir, 'agents'),
    appliedMigrations: appliedMigrations(sqlite),
    startedAt: Date.now(),
  })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('creating an agent', () => {
  test('gives it a readable id and the folder to go with it', async () => {
    const response = await post('/api/agents', DRAFT)
    expect(response.status).toBe(201)
    const { agent } = await response.json()
    expect(agent.id).toBe('reader')
    expect(agent.workspaceDir).toBe(join(dir, 'agents', 'reader'))
    expect(existsSync(agent.workspaceDir)).toBe(true)
  })

  test('starts out asking before it acts', async () => {
    const { agent } = await (await post('/api/agents', DRAFT)).json()
    expect(agent.autonomy).toBe('ask')
    expect(agent.askOnTelegram).toBe(false)
  })

  test('a second agent of the same name gets its own id and folder', async () => {
    await post('/api/agents', DRAFT)
    const { agent } = await (await post('/api/agents', DRAFT)).json()
    expect(agent.id).toBe('reader-2')
    expect(existsSync(agent.workspaceDir)).toBe(true)
  })

  test('a body the schema rejects never reaches the handler', async () => {
    expect((await post('/api/agents', { ...DRAFT, name: '' })).status).toBe(400)
    expect(
      (await post('/api/agents', { ...DRAFT, color: 'puce' })).status,
    ).toBe(400)
    expect((await post('/api/agents', {})).status).toBe(400)
  })
})

describe('deleting an agent', () => {
  test('takes its rows and the folder we made for it', async () => {
    const { agent } = await (await post('/api/agents', DRAFT)).json()
    await post(`/api/agents/${agent.id}/routines`, {
      name: 'Morning read',
      cadence: 'every weekday at seven',
    })

    const response = await app.request(`/api/agents/${agent.id}`, {
      method: 'DELETE',
    })
    expect(response.status).toBe(200)
    expect(existsSync(agent.workspaceDir)).toBe(false)

    const left = await (await app.request('/api/agents')).json()
    expect(left.agents).toHaveLength(0)
  })

  test('leaves a workspace somebody pointed at their own repository alone', async () => {
    const mine = join(dir, 'my-repo')
    const { agent } = await (
      await post('/api/agents', { ...DRAFT, workspaceDir: mine })
    ).json()
    expect(existsSync(mine)).toBe(true)

    await app.request(`/api/agents/${agent.id}`, { method: 'DELETE' })
    expect(existsSync(mine)).toBe(true)
  })

  test('is a 404 rather than a success when there is nothing to delete', async () => {
    const response = await app.request('/api/agents/nobody', {
      method: 'DELETE',
    })
    expect(response.status).toBe(404)
  })
})

describe('routines', () => {
  test('a schedule carries the cron its cadence resolved to', async () => {
    const { agent } = await (await post('/api/agents', DRAFT)).json()
    const { routine } = await (
      await post(`/api/agents/${agent.id}/routines`, {
        name: 'Morning read',
        cadence: 'every weekday at seven',
      })
    ).json()
    expect(routine.cron).toBe('0 7 * * 1-5')
  })

  test('a cadence nobody can read is stored without one rather than refused', async () => {
    const { agent } = await (await post('/api/agents', DRAFT)).json()
    const { routine } = await (
      await post(`/api/agents/${agent.id}/routines`, {
        name: 'Whenever',
        cadence: 'whenever I feel like it',
      })
    ).json()
    expect(routine.cron).toBeNull()
    expect(routine.cadence).toBe('whenever I feel like it')
  })

  test('an event has no time to resolve, so it keeps the phrase alone', async () => {
    const { agent } = await (await post('/api/agents', DRAFT)).json()
    const { routine } = await (
      await post(`/api/agents/${agent.id}/routines`, {
        name: 'On a tag',
        kind: 'event',
        cadence: 'when a tag is pushed',
      })
    ).json()
    expect(routine.cron).toBeNull()
  })

  test('editing the cadence moves the cron with it', async () => {
    const { agent } = await (await post('/api/agents', DRAFT)).json()
    const { routine } = await (
      await post(`/api/agents/${agent.id}/routines`, {
        name: 'Morning read',
        cadence: 'every weekday at seven',
      })
    ).json()

    const edited = await (
      await patch(`/api/routines/${routine.id}`, {
        cadence: 'every day at eight',
      })
    ).json()
    expect(edited.routine.cron).toBe('0 8 * * *')
  })

  test('a toggle alone leaves the cadence and its cron where they were', async () => {
    const { agent } = await (await post('/api/agents', DRAFT)).json()
    const { routine } = await (
      await post(`/api/agents/${agent.id}/routines`, {
        name: 'Morning read',
        cadence: 'every weekday at seven',
      })
    ).json()

    const off = await (
      await patch(`/api/routines/${routine.id}`, { enabled: false })
    ).json()
    expect(off.routine.enabled).toBe(false)
    expect(off.routine.cron).toBe('0 7 * * 1-5')
  })
})

describe('tool access', () => {
  test('flipping one switch twice leaves one row, not two', async () => {
    const { agent } = await (await post('/api/agents', DRAFT)).json()
    const body = { kind: 'server', refId: 'github', enabled: true }

    await patch(`/api/tools/access/${agent.id}`, body)
    await patch(`/api/tools/access/${agent.id}`, { ...body, enabled: false })
    await patch(`/api/tools/access/${agent.id}`, body)

    const { access } = await (
      await app.request(`/api/tools/access/${agent.id}`)
    ).json()
    expect(access).toHaveLength(1)
    expect(access[0].enabled).toBe(true)
  })

  test('two different switches are two rows', async () => {
    const { agent } = await (await post('/api/agents', DRAFT)).json()
    await patch(`/api/tools/access/${agent.id}`, {
      kind: 'server',
      refId: 'github',
      enabled: true,
    })
    await patch(`/api/tools/access/${agent.id}`, {
      kind: 'skill',
      refId: 'github',
      enabled: true,
    })

    const { access } = await (
      await app.request(`/api/tools/access/${agent.id}`)
    ).json()
    expect(access).toHaveLength(2)
  })
})

describe('reading a cadence without committing to it', () => {
  test('answers with the same parse the routine would be stored with', async () => {
    const { cadence } = await (
      await post('/api/cadence', { text: 'every weekday at seven' })
    ).json()
    expect(cadence).toEqual({
      cron: '0 7 * * 1-5',
      reading: 'Monday to Friday at 7am',
    })
  })

  test('says so plainly when it cannot read one', async () => {
    const { cadence } = await (
      await post('/api/cadence', { text: 'whenever I feel like it' })
    ).json()
    expect(cadence).toBeNull()
  })
})
