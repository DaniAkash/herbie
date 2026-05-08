/**
 * Probe whether an npx-fronted package has been cached locally on
 * disk.
 *
 * acpx resolves several agents to `npx -y <pkg>` commands. Those
 * agents "work" the moment the user runs them — npx fetches and
 * caches the package on first use. The Settings dialog lies if it
 * claims they're already installed before that first run, though, so
 * we probe `~/.npm/_npx/<hash>/node_modules/<pkg>/package.json` to
 * distinguish "cached on disk" (truly installed) from "auto-installs
 * via npx on first use" (will fetch later).
 *
 * Cache layout:
 *   ~/.npm/_npx/
 *     <hash-1>/
 *       node_modules/
 *         <pkg>/package.json    ← presence here is the signal
 *     <hash-2>/
 *       …
 *
 * Each `<hash>` directory is a separate npx invocation's deps tree;
 * scanning them all is cheap (~10 ms even with dozens of dirs).
 */

import { glob } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

function getNpxCacheRoot(): string {
  return (
    Bun.env.HERBIE_NPX_CACHE_ROOT ?? path.join(os.homedir(), '.npm', '_npx')
  )
}

/**
 * Returns true when `packageName` is present in any npx cache hash
 * directory. False on no match or any I/O error (treat as "not
 * cached" — the agent will still work on-demand via npx fetch).
 *
 * Accepts both scoped (`@scope/pkg`) and unscoped (`pkg`) names.
 */
export async function probeNpxCache(packageName: string): Promise<boolean> {
  if (!packageName) return false
  const root = getNpxCacheRoot()
  const pattern = `*/node_modules/${packageName}/package.json`
  try {
    for await (const _entry of glob(pattern, { cwd: root })) {
      return true
    }
  } catch {
    // ENOENT on the cache root or any other I/O error: treat as miss.
  }
  return false
}
