import { homedir } from 'node:os'
import path from 'node:path'
import { zValidator } from '@hono/zod-validator'
import type { ResultSet } from '@libsql/client'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { SQLiteTransaction } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import { z } from 'zod'
import type * as schema from '../../db/schema/schema'
import { settings as settingsTable } from '../../db/schema/settings.sql'
import { validateAgentId } from '../agents/registry'
import { getDb } from '../db-singleton'
import { setLoginItem } from '../loginItems'
import {
  type AgentCapability,
  agentCapabilitySchema,
} from './settings.agent-capability.schema'
import { customAgentSchema } from './settings.custom-agent.schema'
import { mcpSchema } from './settings.mcp.schema'

// Adding a new setting:
//   - existing domain: add the field below + a default in SETTINGS_DEFAULTS. No migration.
//   - new domain:      add a top-level key here + entry in DOMAINS + SETTINGS_DEFAULTS. No migration.
// Storage is one row per top-level domain in the `settings` KV table.

const THEME_MODES = ['light', 'dark', 'system'] as const

const generalSchema = z.object({
  launchAtLogin: z.boolean(),
  minimizeToMenubarOnClose: z.boolean(),
})

// defaultAgent is free-form so user-registered custom agents can be
// selected without churning the schema. PATCH handlers validate
// against the live agent registry at write time.
const agentsSchema = z.object({
  defaultAgent: z.string().min(1),
  customAgents: z.array(customAgentSchema).default([]),
})

const appearanceSchema = z.object({
  theme: z.enum(THEME_MODES),
})

const composerSchema = z.object({
  workspaces: z.object({
    default: z.string().min(1),
    recent: z.array(z.string().min(1)),
  }),
  agentCapabilities: z.record(z.string(), agentCapabilitySchema),
})

const settingsSchema = z.object({
  general: generalSchema,
  agents: agentsSchema,
  appearance: appearanceSchema,
  composer: composerSchema,
  mcp: mcpSchema,
})

const DOMAINS = ['general', 'agents', 'appearance', 'composer', 'mcp'] as const

type Settings = z.infer<typeof settingsSchema>
type Domain = keyof Settings

export type { AgentCapability } from './settings.agent-capability.schema'

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

// Pre-resolved at module load — settings can be read before the workspace
// bootstrap mkdirs the directory, so the default has to be a usable path
// without requiring a row in the KV table.
const DEFAULT_WORKSPACE_PATH = path.join(homedir(), 'herbie-workspace')

const SETTINGS_DEFAULTS: Settings = {
  general: { launchAtLogin: false, minimizeToMenubarOnClose: true },
  agents: { defaultAgent: 'claude', customAgents: [] },
  appearance: { theme: 'system' },
  composer: {
    workspaces: { default: DEFAULT_WORKSPACE_PATH, recent: [] },
    agentCapabilities: {},
  },
  mcp: { servers: [] },
}

// Schemas for PATCH bodies: validation only, no defaults — defaults belong to
// SETTINGS_DEFAULTS. (Earlier versions used `generalSchema.partial()` with
// inner `.default()` calls, but `.partial()` doesn't strip defaults, so a
// PATCH of one field would inflate to the full domain with all defaults.)
//
// `composer.workspaces` is itself partial: callers can PATCH just
// `{recent: [...]}` without having to ship the current `default` (which
// might still be loading on the client). The handler merges field-wise.
const composerPatchSchema = z.object({
  workspaces: z
    .object({
      default: z.string().min(1).optional(),
      recent: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  agentCapabilities: z.record(z.string(), agentCapabilitySchema).optional(),
})

const patchSchema = z
  .object({
    general: generalSchema.partial().optional(),
    agents: agentsSchema.partial().optional(),
    appearance: appearanceSchema.partial().optional(),
    composer: composerPatchSchema.optional(),
    mcp: mcpSchema.partial().optional(),
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

// Programmatic accessor for non-route callers (bootstrap, capability cache).
export async function readSettings(): Promise<Settings> {
  return readAll(getDb())
}

export async function readAgentCapability(
  db: DbLike,
  agentId: string,
): Promise<AgentCapability | undefined> {
  const settings = await readAll(db)
  return settings.composer.agentCapabilities[agentId]
}

// Merges new capability entries into composer.agentCapabilities. Used by
// the discovery probe — runs in its own transaction so a concurrent PATCH
// on another domain can't lose the write.
export async function patchAgentCapabilities(
  db: ReturnType<typeof getDb>,
  patch: Record<string, AgentCapability>,
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await readAll(tx)
    const merged = {
      ...current.composer,
      agentCapabilities: {
        ...current.composer.agentCapabilities,
        ...patch,
      },
    }
    await writeDomain(tx, 'composer', merged)
  })
}

// Drops an agent's cached capability so the next picker open re-runs
// discovery. Used by the bootstrap migration when shipped defaults
// changed (e.g. claude's bogus reasoning entry from an earlier build).
export async function clearAgentCapability(
  db: ReturnType<typeof getDb>,
  agentId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await readAll(tx)
    if (!(agentId in current.composer.agentCapabilities)) return
    const { [agentId]: _dropped, ...rest } = current.composer.agentCapabilities
    await writeDomain(tx, 'composer', {
      ...current.composer,
      agentCapabilities: rest,
    })
  })
}

// Removes a path from composer.workspaces.recent. Called from the workspace
// existence guard when the user-pinned path was deleted out from under us.
export async function removeRecentWorkspace(
  db: ReturnType<typeof getDb>,
  path: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await readAll(tx)
    const next = current.composer.workspaces.recent.filter((p) => p !== path)
    if (next.length === current.composer.workspaces.recent.length) return
    await writeDomain(tx, 'composer', {
      ...current.composer,
      workspaces: { ...current.composer.workspaces, recent: next },
    })
  })
}

export const settingsRoute = new Hono()
  .get('/settings', async (c) => {
    return c.json(await readAll(getDb()))
  })
  .patch('/settings', zValidator('json', patchSchema), async (c) => {
    const patch = c.req.valid('json')

    if (patch.agents?.defaultAgent !== undefined) {
      const agentError = await validateAgentId(patch.agents.defaultAgent)
      if (agentError) return c.json({ error: agentError }, 400)
    }

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
      if (patch.appearance) {
        await writeDomain(tx, 'appearance', {
          ...current.appearance,
          ...patch.appearance,
        })
      }
      if (patch.composer) {
        // Top-level shallow merge for composer, but nested workspaces
        // merges field-wise so a partial {workspaces: {recent: [...]}}
        // doesn't blank out `default`.
        const ws = patch.composer.workspaces
        const mergedComposer = {
          ...current.composer,
          ...(patch.composer.agentCapabilities && {
            agentCapabilities: patch.composer.agentCapabilities,
          }),
          ...(ws && {
            workspaces: {
              default: ws.default ?? current.composer.workspaces.default,
              recent: ws.recent ?? current.composer.workspaces.recent,
            },
          }),
        }
        await writeDomain(tx, 'composer', mergedComposer)
      }
      if (patch.mcp) {
        await writeDomain(tx, 'mcp', {
          ...current.mcp,
          ...patch.mcp,
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
