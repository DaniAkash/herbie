import { glob } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { splitArgv } from 'acp-probe'

export type InstallState = 'installed' | 'npx-available' | 'not-installed'

export interface Detected {
  readonly installState: InstallState
  readonly version: string | null
}

const PROBE_TIMEOUT_MS = 3_000

/**
 * Whether a command is on PATH, and what it says its version is.
 *
 * `command -v` rather than looking for a file, because a runtime installed
 * through a version manager is a shim that no fixed path would find.
 */
async function onPath(bin: string): Promise<Detected> {
  const lookup = Bun.spawn(['sh', '-c', `command -v ${bin}`], {
    stdout: 'pipe',
    stderr: 'ignore',
  })
  const found = (await lookup.exited) === 0
  if (!found) return { installState: 'not-installed', version: null }

  const probe = Bun.spawn([bin, '--version'], {
    stdout: 'pipe',
    stderr: 'ignore',
  })
  const timer = setTimeout(() => probe.kill(), PROBE_TIMEOUT_MS)
  const code = await probe.exited
  clearTimeout(timer)
  const out = code === 0 ? await new Response(probe.stdout).text() : ''
  return {
    installState: 'installed',
    version: out.trim().split('\n')[0] || null,
  }
}

/**
 * Whether npx has already fetched this package.
 *
 * An npx based runtime always works, so the distinction is not can it run but
 * will the first launch stall on a download. That is worth saying out loud in
 * a picker rather than leaving someone watching a spinner.
 */
async function inNpxCache(pkg: string): Promise<boolean> {
  const root = join(homedir(), '.npm', '_npx')
  try {
    for await (const _ of glob(`*/node_modules/${pkg}/package.json`, {
      cwd: root,
    })) {
      return true
    }
  } catch {
    // No cache root yet, or it cannot be read. Either way npx will fetch.
  }
  return false
}

/** The package an `npx` command would run, without its version pin. */
function npxPackage(argv: readonly string[]): string | null {
  const at = argv.findIndex((token, i) => i > 0 && !token.startsWith('-'))
  if (at < 0) return null
  const raw = argv[at] ?? ''
  // The leading @ of a scoped name sits at index 0, so only a later one is a
  // version pin.
  const lastAt = raw.lastIndexOf('@')
  return lastAt > 0 ? raw.slice(0, lastAt) : raw || null
}

export async function detect(command: string): Promise<Detected> {
  const argv = splitArgv(command)
  const head = argv[0] ?? ''
  if (!head) return { installState: 'not-installed', version: null }

  if (head === 'npx' || head === 'bunx') {
    const pkg = npxPackage(argv)
    const cached = pkg ? await inNpxCache(pkg) : false
    return {
      installState: cached ? 'installed' : 'npx-available',
      version: null,
    }
  }
  return onPath(head)
}
