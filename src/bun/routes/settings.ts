import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
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

async function readAll(): Promise<Settings> {
  const db = getDb()
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
  domain: K,
  value: Settings[K],
): Promise<void> {
  const db = getDb()
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
    return c.json(await readAll())
  })
  .patch('/settings', zValidator('json', patchSchema), async (c) => {
    const patch = c.req.valid('json')
    const current = await readAll()

    if (patch.general) {
      const merged = { ...current.general, ...patch.general }
      await writeDomain('general', merged)
      if (patch.general.launchAtLogin !== undefined) {
        await setLoginItem(patch.general.launchAtLogin)
      }
    }
    if (patch.agents) {
      const merged = { ...current.agents, ...patch.agents }
      await writeDomain('agents', merged)
    }

    return c.json(await readAll())
  })
