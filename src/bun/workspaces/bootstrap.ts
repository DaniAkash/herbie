import { mkdir } from 'node:fs/promises'
import { readSettings } from '../routes/settings'

// First-boot guard: ensure the default workspace directory exists. The KV
// row's default path is resolved at module load (homedir/herbie-workspace)
// so no settings write is needed unless the user changes it. Idempotent —
// safe to call on every boot. If the user later deletes the directory we
// don't recreate it; the runtime falls back at session-creation time.
export async function ensureDefaultWorkspace(): Promise<void> {
  const settings = await readSettings()
  await mkdir(settings.composer.workspaces.default, { recursive: true })
}
