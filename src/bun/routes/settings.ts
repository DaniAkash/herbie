import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { settings as settingsTable } from '../../db/schema/settings.sql'
import { getDb } from '../db-singleton'
import { setLoginItem } from '../loginItems'

// Adding a new setting:
//   - existing domain: add the field below + a default. No migration.
//   - new domain:      add a top-level key here + a default. No migration.
// Storage is one row per top-level domain in the `settings` KV table.

const AGENT_IDS = ['claude', 'codex', 'gemini', 'hermes'] as const

const generalSchema = z.object({
  launchAtLogin: z.boolean().default(false),
  minimizeToMenubarOnClose: z.boolean().default(true),
})

const agentsSchema = z.object({
  defaultAgent: z.enum(AGENT_IDS).default('claude'),
})

const settingsSchema = z.object({
  general: generalSchema,
  agents: agentsSchema,
})

const DOMAINS = ['general', 'agents'] as const

const patchSchema = z
  .object({
    general: generalSchema.partial().optional(),
    agents: agentsSchema.partial().optional(),
  })
  .strict()

type Settings = z.infer<typeof settingsSchema>
type Domain = keyof Settings

async function readAll(): Promise<Settings> {
  const db = getDb()
  const rows = await db.select().from(settingsTable).all()
  // Seed each domain so missing rows fall through to zod's per-field defaults.
  const stored: Record<string, unknown> = Object.fromEntries(
    DOMAINS.map((d) => [d, {}]),
  )
  for (const { key, value } of rows) {
    try {
      stored[key] = JSON.parse(value)
    } catch {
      // Corrupt row: ignore and let zod fall back to defaults.
    }
  }
  return settingsSchema.parse(stored)
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
