import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '@bun/modules/db/db'
import { ensureInstalledAt } from '@bun/modules/db/install'
import { appliedMigrations, pendingMigrations } from '@bun/modules/db/migrate'
import { agents } from '@bun/modules/db/schema/schema'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'herbie-db-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('opening the database', () => {
  test('migrates a fresh file and leaves nothing pending', () => {
    const { sqlite } = openDb(join(dir, 'herbie.sqlite'))
    expect(pendingMigrations(sqlite)).toHaveLength(0)
    expect(appliedMigrations(sqlite)).toContain('0000_init_schema')
  })

  test('is safe to run twice, which is every launch after the first', () => {
    const path = join(dir, 'herbie.sqlite')
    openDb(path).sqlite.close()
    const { sqlite } = openDb(path)
    expect(appliedMigrations(sqlite)).toHaveLength(1)
  })

  test('writes and reads back through drizzle', () => {
    const { db } = openDb(join(dir, 'herbie.sqlite'))
    db.insert(agents)
      .values({
        id: 'a1',
        name: 'Scout',
        acpAgent: 'claude',
        workspaceDir: '/tmp/scout',
      })
      .run()
    const rows = db.select().from(agents).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.enabled).toBe(true)
  })
})

describe('the install stamp', () => {
  test('is written once and kept on later boots', () => {
    const { db } = openDb(join(dir, 'herbie.sqlite'))
    const first = ensureInstalledAt(db, new Date('2020-01-01T00:00:00.000Z'))
    const second = ensureInstalledAt(db, new Date('2030-01-01T00:00:00.000Z'))
    expect(second).toBe(first)
  })
})
