import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publish } from '@bun/modules/conversation/bus'
import { hold } from '@bun/modules/conversation/pending'
import {
  openTranscript,
  resetTranscripts,
} from '@bun/modules/conversation/transcript'
import { openDb } from '@bun/modules/db/db'
import { appliedMigrations } from '@bun/modules/db/migrate'
import { createApp } from '@bun/server/app'
import type { TranscriptRecord } from '@bun/shared/transcript'

let dir: string
let app: ReturnType<typeof createApp>
let workspace: string

const DRAFT = {
  name: 'Postman',
  color: 'post',
  brief: 'You draft social posts from my GitHub activity.',
  acpAgent: 'claude',
  effort: 'medium',
}

function post(path: string, json: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(json),
  })
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'herbie-conversation-'))
  const { db, sqlite, path } = openDb(join(dir, 'herbie.sqlite'))
  app = createApp({
    db,
    databasePath: path,
    agentsRoot: join(dir, 'agents'),
    skillsWorkspace: join(dir, 'skills'),
    appliedMigrations: appliedMigrations(sqlite),
    startedAt: Date.now(),
  })
  const created = await post('/api/agents', DRAFT)
  workspace = (await created.json()).agent.workspaceDir
})

afterEach(() => {
  resetTranscripts()
  rmSync(dir, { recursive: true, force: true })
})

/** Writes blocks the way a turn would, without needing an agent process. */
function seed(count: number): void {
  const transcript = openTranscript(workspace)
  for (let n = 1; n <= count; n += 1) {
    transcript.append('t_1', { kind: 'say', text: `line ${n}` })
  }
}

async function records(path: string) {
  const response = await app.request(path)
  expect(response.status).toBe(200)
  return (await response.json()) as {
    records: TranscriptRecord[]
    lastSeq: number
    live: unknown
  }
}

describe('replaying a thread', () => {
  test('answers the whole thread, and its length', async () => {
    seed(3)
    const page = await records('/api/agents/postman/transcript')
    expect(page.records.map((r) => r.seq)).toEqual([1, 2, 3])
    expect(page.lastSeq).toBe(3)
    expect(page.live).toBeNull()
  })

  test('answers only what is after the cursor', async () => {
    seed(3)
    const page = await records('/api/agents/postman/transcript?after=2')
    expect(page.records.map((r) => r.seq)).toEqual([3])
  })

  test('is empty rather than missing before the first turn', async () => {
    const page = await records('/api/agents/postman/transcript')
    expect(page.records).toEqual([])
    expect(page.lastSeq).toBe(0)
  })

  test('404s for an agent that does not exist', async () => {
    const response = await app.request('/api/agents/nobody/transcript')
    expect(response.status).toBe(404)
  })
})

describe('the stream', () => {
  test('replays from disk, then pushes what arrives after', async () => {
    seed(2)
    const response = await app.request('/api/agents/postman/stream')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    const reader = response.body?.getReader()
    if (!reader) throw new Error('the stream had no body')
    const decoder = new TextDecoder()
    let text = ''

    // The turn event and both replayed records, before anything live.
    while (!text.includes('"seq":2')) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
    expect(text).toContain('event: turn')
    expect(text).toContain('line 1')
    expect(text).toContain('line 2')

    publish('postman', {
      seq: 3,
      id: 'r_3',
      at: new Date().toISOString(),
      turn: 't_1',
      kind: 'say',
      text: 'arrived live',
    })

    while (!text.includes('arrived live')) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
    expect(text).toContain('arrived live')
    await reader.cancel()
  })

  test('does not replay below the cursor it was given', async () => {
    seed(2)
    const response = await app.request('/api/agents/postman/stream?after=1')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('the stream had no body')
    const decoder = new TextDecoder()
    let text = ''
    while (!text.includes('line 2')) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
    expect(text).not.toContain('line 1')
    await reader.cancel()
  })
})

describe('answering a question', () => {
  test('hands the answers over once, then refuses a second time', async () => {
    let handed: unknown = null
    hold<Record<string, readonly number[]>>('postman', 'r_7', {
      resolve: (value) => {
        handed = value
      },
      onCancel: () => ({}),
    })
    // The session has to exist for an answer to be filed against its thread.
    await post('/api/agents/postman/session', {})

    const first = await post('/api/agents/postman/answers/r_7', {
      answers: { '0': [1] },
    })
    expect(first.status).toBe(200)
    expect(handed).toEqual({ '0': [1] })

    const second = await post('/api/agents/postman/answers/r_7', {
      answers: { '0': [0] },
    })
    expect(second.status).toBe(409)
  })

  test('409s when nothing was waiting on that record', async () => {
    await post('/api/agents/postman/session', {})
    const response = await post('/api/agents/postman/answers/r_never', {
      answers: { '0': [0] },
    })
    expect(response.status).toBe(409)
  })

  test('reports whether a block is still waiting', async () => {
    hold<unknown>('postman', 'r_8', { resolve: () => {}, onCancel: () => null })
    const waiting = await app.request('/api/agents/postman/pending/r_8')
    expect(await waiting.json()).toEqual({ pending: true })
    const settled = await app.request('/api/agents/postman/pending/r_other')
    expect(await settled.json()).toEqual({ pending: false })
  })
})

describe('deciding a permission', () => {
  test('409s when no session is live', async () => {
    const response = await post('/api/agents/postman/permissions/call_1', {
      optionId: 'allow',
      recordId: 'r_5',
    })
    expect(response.status).toBe(409)
  })
})

describe('cancelling', () => {
  test('says so plainly when there was nothing to cancel', async () => {
    const response = await post('/api/agents/postman/turns/cancel', {})
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ cancelled: false })
  })
})

describe('starting a turn', () => {
  test('404s for an agent that does not exist', async () => {
    const response = await post('/api/agents/nobody/turns', { text: 'hello' })
    expect(response.status).toBe(404)
  })

  test('refuses an empty message rather than starting an agent for it', async () => {
    const response = await post('/api/agents/postman/turns', { text: '  ' })
    expect(response.status).toBe(400)
  })
})
