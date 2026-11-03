import type { Db } from '@bun/modules/db/db'
import { agents, runtimes } from '@bun/modules/db/schema/schema'
import { detect } from '@bun/modules/runtimes/detect'
import { probe } from '@bun/modules/runtimes/probe'
import {
  candidate,
  candidates,
  type RuntimeCandidate,
} from '@bun/modules/runtimes/registry'
import { count, eq } from 'drizzle-orm'

/** Installed first, then what npx would fetch, then what is not there. */
const ORDER: Record<string, number> = {
  installed: 0,
  'npx-available': 1,
  'not-installed': 2,
}

/** An install state nothing recognises sorts last rather than throwing. */
function rankOf(state: string): number {
  return ORDER[state] ?? ORDER['not-installed'] ?? 2
}

/** How long a probe answer is trusted before it is taken again. */
const FRESH_MS = 24 * 60 * 60 * 1000

export interface RuntimeView {
  readonly id: string
  readonly displayName: string
  readonly installUrl: string
  readonly installState: string
  readonly version: string | null
  readonly signedIn: boolean
  readonly models: readonly string[]
  readonly modelValues: readonly string[]
  readonly efforts: readonly string[]
  readonly probedAt: string | null
  readonly probeError: string | null
  /** Whether the cached probe still stands, for the picker's wording. */
  readonly fresh: boolean
  /** How many agents already run on this, which is what the row reads. */
  readonly agentCount: number
}

function parseList(json: string): readonly string[] {
  try {
    const value = JSON.parse(json)
    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}

/**
 * Whether a stored probe can still be believed.
 *
 * Age alone is not enough. An adapter upgrade is exactly when a model list
 * moves, so a version that no longer matches what is installed invalidates
 * the answer however recent it was.
 */
export function isFresh(
  row: Pick<typeof runtimes.$inferSelect, 'probedAt' | 'version'> | undefined,
  version: string | null,
  now: number,
): boolean {
  if (!row?.probedAt) return false
  if (row.version !== version) return false
  return now - Date.parse(row.probedAt) < FRESH_MS
}

function view(
  c: RuntimeCandidate,
  row: typeof runtimes.$inferSelect | undefined,
  detected: { installState: string; version: string | null },
  agentCount: number,
  now: number,
): RuntimeView {
  return {
    id: c.id,
    displayName: c.displayName,
    installUrl: c.installUrl,
    installState: detected.installState,
    version: detected.version,
    signedIn: row?.signedIn ?? false,
    models: parseList(row?.models ?? '[]'),
    modelValues: parseList(row?.modelValues ?? '[]'),
    efforts: parseList(row?.efforts ?? '[]'),
    probedAt: row?.probedAt ?? null,
    probeError: row?.probeError ?? null,
    fresh: isFresh(row, detected.version, now),
    agentCount,
  }
}

/**
 * Every runtime, with what we know about it right now.
 *
 * Detection runs on every call because it is a few milliseconds and the
 * answer changes when someone installs something. The probe never runs here:
 * a list that spawns fifteen coding agents is not a list.
 */
export async function listRuntimes(db: Db): Promise<readonly RuntimeView[]> {
  const now = Date.now()
  const rows = new Map(
    db
      .select()
      .from(runtimes)
      .all()
      .map((row) => [row.id, row]),
  )
  const counts = new Map(
    db
      .select({ id: agents.acpAgent, value: count() })
      .from(agents)
      .groupBy(agents.acpAgent)
      .all()
      .map((row) => [row.id, row.value]),
  )

  const list = candidates()
  const detected = await Promise.all(list.map((c) => detect(c.command)))
  const views = list.map((c, i) =>
    view(
      c,
      rows.get(c.id),
      detected[i] ?? { installState: 'not-installed', version: null },
      counts.get(c.id) ?? 0,
      now,
    ),
  )

  // Ordered by what can actually be used, not by name. acpx knows about
  // thirty of these and a machine usually has two or three, so alphabetical
  // order buries the real choices among a list of things to go and install.
  return views.sort((a, b) => {
    const rank = rankOf(a.installState) - rankOf(b.installState)
    if (rank !== 0) return rank
    if (a.agentCount !== b.agentCount) return b.agentCount - a.agentCount
    return a.displayName.localeCompare(b.displayName)
  })
}

/** Probes one runtime and stores what it said. */
export async function probeRuntime(
  db: Db,
  id: string,
): Promise<RuntimeView | null> {
  const c = candidate(id)
  if (!c) return null

  const detected = await detect(c.command)
  const result = await probe(c.command)
  const row = {
    id: c.id,
    displayName: c.displayName,
    installState: detected.installState,
    version: detected.version,
    installUrl: c.installUrl,
    signedIn: result.signedIn,
    supportsConfigOption: result.supportsConfigOption,
    models: JSON.stringify(result.models),
    modelValues: JSON.stringify(result.modelValues),
    efforts: JSON.stringify(result.efforts),
    probedAt: new Date().toISOString(),
    probeError: result.error,
  }

  db.insert(runtimes)
    .values(row)
    .onConflictDoUpdate({ target: runtimes.id, set: row })
    .run()

  const agentCount =
    db
      .select({ value: count() })
      .from(agents)
      .where(eq(agents.acpAgent, id))
      .get()?.value ?? 0

  return view(c, row, detected, agentCount, Date.now())
}
