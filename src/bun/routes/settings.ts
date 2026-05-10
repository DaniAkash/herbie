import { zValidator } from '@hono/zod-validator'
import type { ResultSet } from '@libsql/client'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { SQLiteTransaction } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import { z } from 'zod'
import type * as schema from '../../db/schema/schema'
import { settings as settingsTable } from '../../db/schema/settings.sql'
import { getDb } from '../db-singleton'
import { setLoginItem } from '../loginItems'

// Adding a new setting:
//   - existing domain: add the field below + a default in SETTINGS_DEFAULTS. No migration.
//   - new domain:      add a top-level key here + entry in DOMAINS + SETTINGS_DEFAULTS. No migration.
// Storage is one row per top-level domain in the `settings` KV table.

const AGENT_IDS = ['claude', 'codex', 'gemini', 'hermes'] as const

const generalSchema = z.object({
  launchAtLogin: z.boolean(),
  minimizeToMenubarOnClose: z.boolean(),
})

const agentsSchema = z.object({
  defaultAgent: z.enum(AGENT_IDS),
})

const settingsSchema = z.object({
  general: generalSchema,
  agents: agentsSchema,
})

const DOMAINS = ['general', 'agents'] as const

type Settings = z.infer<typeof settingsSchema>
type Domain = keyof Settings

// Accepts either the top-level db or a transaction handle — both expose
// the same SQLite query surface we use here (select / insert / update).
type DbLike =
  | ReturnType<typeof getDb>
  | SQLiteTransaction<
      'async',
      ResultSet,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >

const SETTINGS_DEFAULTS: Settings = {
  general: { launchAtLogin: false, minimizeToMenubarOnClose: true },
  agents: { defaultAgent: 'claude' },
}

// Schemas for PATCH bodies: validation only, no defaults — defaults belong to
// SETTINGS_DEFAULTS. (Earlier versions used `generalSchema.partial()` with
// inner `.default()` calls, but `.partial()` doesn't strip defaults, so a
// PATCH of one field would inflate to the full domain with all defaults.)
const patchSchema = z
  .object({
    general: generalSchema.partial().optional(),
    agents: agentsSchema.partial().optional(),
  })
  .strict()

async function readAll(db: DbLike): Promise<Settings> {
  const rows = await db.select().from(settingsTable).all()
  const settings = structuredClone(SETTINGS_DEFAULTS)
  for (const { key, value } of rows) {
    if (!(DOMAINS as readonly string[]).includes(key)) continue
    try {
      const parsed = JSON.parse(value)
      const domain = key as Domain
      settings[domain] = { ...settings[domain], ...parsed }
    } catch {
      // Corrupt row: leave the domain at its defaults.
    }
  }
  return settingsSchema.parse(settings)
}

async function writeDomain<K extends Domain>(
  db: DbLike,
  domain: K,
  value: Settings[K],
): Promise<void> {
  const json = JSON.stringify(value)
  const now = new Date()
  await db
    .insert(settingsTable)
    .values({ key: domain, value: json, updatedAt: now })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: json, updatedAt: now },
    })
    .run()
}

export const settingsRoute = new Hono()
  .get('/settings', async (c) => {
    return c.json(await readAll(getDb()))
  })
  .patch('/settings', zValidator('json', patchSchema), async (c) => {
    const patch = c.req.valid('json')

    // Read+merge+write inside a single transaction so concurrent PATCHes to
    // the same domain can't interleave and lose updates (last-write-wins).
    const next = await getDb().transaction(async (tx) => {
      const current = await readAll(tx)
      if (patch.general) {
        await writeDomain(tx, 'general', {
          ...current.general,
          ...patch.general,
        })
      }
      if (patch.agents) {
        await writeDomain(tx, 'agents', {
          ...current.agents,
          ...patch.agents,
        })
      }
      return readAll(tx)
    })

    // Side effects belong outside the transaction — the OS-level LaunchAgent
    // change is not rollback-safe and would otherwise hold the tx open.
    if (patch.general?.launchAtLogin !== undefined) {
      await setLoginItem(patch.general.launchAtLogin)
    }

    return c.json(next)
  })
