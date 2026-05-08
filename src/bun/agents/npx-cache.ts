import { glob } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

function getNpxCacheRoot(): string {
  return (
    Bun.env.HERBIE_NPX_CACHE_ROOT ?? path.join(os.homedir(), '.npm', '_npx')
  )
}

export async function probeNpxCache(packageName: string): Promise<boolean> {
  if (!packageName) return false
  const root = getNpxCacheRoot()
  const pattern = `*/node_modules/${packageName}/package.json`
  try {
    for await (const _entry of glob(pattern, { cwd: root })) {
      return true
    }
  } catch {
    // I/O error (ENOENT on the cache root, etc.): treat as miss — npx will fetch on first use.
  }
  return false
}
