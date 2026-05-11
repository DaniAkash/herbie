import { mkdir } from 'node:fs/promises'
import { getDb } from '../db-singleton'
import { clearAgentCapability, readSettings } from '../routes/settings'

// First-boot guard: ensure the default workspace directory exists. The KV
// row's default path is resolved at module load (homedir/herbie-workspace)
// so no settings write is needed unless the user changes it. Idempotent —
// safe to call on every boot. If the user later deletes the directory we
// don't recreate it; the runtime falls back at session-creation time.
export async function ensureDefaultWorkspace(): Promise<void> {
  const settings = await readSettings()
  await mkdir(settings.composer.workspaces.default, { recursive: true })
}

// One-shot migration: an earlier build shipped claude with a hardcoded
// reasoning_effort capability, but the live claude ACP server actually
// rejects that key. Drop the stale entry so the picker hides for claude
// and the next discovery rebuilds it correctly.
export async function migrateStaleCapabilities(): Promise<void> {
  const settings = await readSettings()
  const claudeCap = settings.composer.agentCapabilities.claude
  if (claudeCap?.reasoning) {
    await clearAgentCapability(getDb(), 'claude')
  }
}
