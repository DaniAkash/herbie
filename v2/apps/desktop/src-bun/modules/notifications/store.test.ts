import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Db } from '@bun/modules/db/db'
import { openDb } from '@bun/modules/db/db'
import { agents } from '@bun/modules/db/schema/schema'
import {
  listNotifications,
  markDelivered,
  markDismissed,
  markSeen,
  type NotificationDraft,
  record,
  seeAgent,
  unseenAgents,
  withdrawAgent,
} from '@bun/modules/notifications/store'
import { eq } from 'drizzle-orm'

let dir: string
let db: Db
let close: () => void

const draft = (over: Partial<NotificationDraft> = {}): NotificationDraft => ({
  kind: 'needs_you',
  reason: 'permission',
  agentId: 'scout',
  turnId: 't1',
  collapseKey: 'scout',
  title: 'Scout',
  body: 'Wants to run something',
  route: '/agents/scout',
  ...over,
})

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'herbie-notify-'))
  const handle = openDb(join(dir, 'herbie.sqlite'))
  db = handle.db
  close = () => handle.sqlite.close()
  for (const id of ['scout', 'house']) {
    db.insert(agents)
      .values({
        id,
        name: id,
        acpAgent: 'claude',
        workspaceDir: join(dir, id),
      })
      .run()
  }
})

afterEach(() => {
  close()
  rmSync(dir, { recursive: true, force: true })
})

describe('writing an event', () => {
  test('the first one starts with no swallowed history', () => {
    const row = record(db, draft())
    expect(row.updates).toBe(0)
    expect(row.agentId).toBe('scout')
  })

  test('a second event for the same agent replaces rather than stacks', () => {
    record(db, draft())
    const second = record(db, draft({ body: 'Wants to write a file' }))
    expect(second.updates).toBe(1)
    expect(listNotifications(db)).toHaveLength(1)
    expect(second.body).toBe('Wants to write a file')
  })

  test('a third keeps counting', () => {
    record(db, draft())
    record(db, draft())
    expect(record(db, draft()).updates).toBe(2)
  })

  test('two agents hold their own rows', () => {
    record(db, draft())
    record(db, draft({ agentId: 'house', collapseKey: 'house' }))
    expect(listNotifications(db)).toHaveLength(2)
    expect([...unseenAgents(db)].sort()).toEqual(['house', 'scout'])
  })

  test('a replacement clears the previous delivery, so it is sent again', () => {
    const first = record(db, draft())
    markDelivered(db, first.id, {
      inbox: 'ok',
      desktop: 'ok',
      telegram: 'skip',
    })
    expect(record(db, draft()).deliveredAt).toBe(null)
  })
})

/**
 * The counter has to be cleared on every path where the person demonstrably
 * saw it. agent-terminal shipped a version that cleared on one path only, and
 * the next notification for that agent then overstated its own history.
 */
describe('every path that clears the counter', () => {
  test('dismissing it', () => {
    record(db, draft())
    const row = record(db, draft())
    expect(row.updates).toBe(1)
    markDismissed(db, row.id)
    expect(listNotifications(db)[0]?.updates).toBe(0)
  })

  test('clicking it, which marks it seen', () => {
    record(db, draft())
    const row = record(db, draft())
    markSeen(db, row.id)
    expect(listNotifications(db)[0]?.updates).toBe(0)
  })

  test('visiting the agent thread', () => {
    record(db, draft())
    record(db, draft())
    seeAgent(db, 'scout')
    expect(listNotifications(db)[0]?.updates).toBe(0)
  })

  test('the agent moving on, which withdraws it', () => {
    record(db, draft())
    record(db, draft())
    withdrawAgent(db, 'scout')
    expect(listNotifications(db)[0]?.updates).toBe(0)
  })

  test('counting restarts from zero after it was seen', () => {
    record(db, draft())
    record(db, draft())
    seeAgent(db, 'scout')
    expect(record(db, draft()).updates).toBe(0)
  })
})

describe('what counts as still waiting', () => {
  test('a seen row no longer waits', () => {
    const row = record(db, draft())
    markSeen(db, row.id)
    expect(unseenAgents(db)).toEqual([])
  })

  test('a dismissed row no longer waits', () => {
    const row = record(db, draft())
    markDismissed(db, row.id)
    expect(unseenAgents(db)).toEqual([])
  })

  test('a withdrawn row no longer waits', () => {
    record(db, draft())
    withdrawAgent(db, 'scout')
    expect(unseenAgents(db)).toEqual([])
  })

  test('seeing one agent leaves the other waiting', () => {
    record(db, draft())
    record(db, draft({ agentId: 'house', collapseKey: 'house' }))
    seeAgent(db, 'scout')
    expect(unseenAgents(db)).toEqual(['house'])
  })

  test('a seen row stays in the list as the record of what happened', () => {
    const row = record(db, draft())
    markSeen(db, row.id)
    expect(listNotifications(db)).toHaveLength(1)
  })

  test('seeing a row twice does not move the first timestamp', () => {
    const row = record(db, draft())
    markSeen(db, row.id)
    const first = listNotifications(db)[0]?.seenAt
    markSeen(db, row.id)
    expect(listNotifications(db)[0]?.seenAt).toBe(first)
  })
})

describe('deleting an agent', () => {
  test('takes its notifications with it', () => {
    record(db, draft())
    db.delete(agents).where(eq(agents.id, 'scout')).run()
    expect(listNotifications(db)).toHaveLength(0)
  })
})
