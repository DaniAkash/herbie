/**
 * Detect which ACP agents are usable on this machine.
 *
 * For each agent enumerated by acpx's runtime registry:
 *   - parse the spawn command,
 *   - probe the underlying binary with `command -v` (PATH-based agents)
 *     OR scan the npx cache for a cached install (npx-fronted agents),
 *   - try `<bin> --version` for a version string when PATH-resolved
 *     (best-effort; some CLIs use non-standard flags),
 *   - overlay display metadata (display name, install URL).
 *
 * Auth state is *not* probed here — the honest verifier is to actually
 * try bringing up an ACP session via acpx-ai-provider's prepare() in
 * response to a user-initiated "Test" action. Anything we'd compute
 * here would be fragile per-agent guesswork that often disagrees with
 * the real session bring-up.
 *
 * Probes run in parallel under a per-probe timeout so a misbehaving
 * binary cannot hang the response.
 */

import { spawn } from 'node:child_process'
import { createAgentRegistry } from 'acpx/runtime'
import { probeNpxCache } from './npx-cache'
import {
  type AcpAgentDisplayMeta,
  getDisplayMeta,
  parseNpxPackageName,
  parseSpawnCommand,
} from './registry-meta'

export type AcpInstallState = 'installed' | 'npx-available' | 'not-installed'

export interface AcpAgentDetection {
  agentId: string
  displayName: string
  installState: AcpInstallState
  /** Best-effort version string (PATH-resolved binaries only). */
  version: string | null
  installUrl: string
  /** True when starting an ACP session right now is feasible. */
  acpReady: boolean
  /** True when the agent runs via `npx`. */
  npxBased: boolean
}

const PROBE_TIMEOUT_MS = 3_000

const STATE_ORDER: Record<AcpInstallState, number> = {
  installed: 0,
  'npx-available': 1,
  'not-installed': 2,
}

// Hermes isn't in acpx 0.7.0 built-ins yet — register via override.
// Drop this when acpx ships native hermes support.
const registry = createAgentRegistry({
  overrides: { hermes: 'hermes acp' },
})

export interface DetectAgentsOptions {
  /** Override the binary probe (testing). */
  binProbeOverride?: (
    bin: string,
  ) => Promise<{ found: boolean; version: string | null }>
  /** Override the npx-cache probe (testing). */
  npxProbeOverride?: (packageName: string) => Promise<boolean>
  timeoutMs?: number
}

export async function detectAcpAgents(
  options: DetectAgentsOptions = {},
): Promise<AcpAgentDetection[]> {
  const ids = registry.list()
  const binProbe = options.binProbeOverride ?? probeBinary
  const npxProbe = options.npxProbeOverride ?? probeNpxCache
  const timeout = options.timeoutMs ?? PROBE_TIMEOUT_MS

  const results = await Promise.all(
    ids.map((agentId) => probeAgent(agentId, binProbe, npxProbe, timeout)),
  )

  return results.sort((a, b) => {
    const s = STATE_ORDER[a.installState] - STATE_ORDER[b.installState]
    if (s !== 0) return s
    return a.displayName.localeCompare(b.displayName)
  })
}

async function probeAgent(
  agentId: string,
  binProbe: NonNullable<DetectAgentsOptions['binProbeOverride']>,
  npxProbe: NonNullable<DetectAgentsOptions['npxProbeOverride']>,
  timeoutMs: number,
): Promise<AcpAgentDetection> {
  const overlay = getDisplayMeta(agentId)
  let command: string
  try {
    command = registry.resolve(agentId)
  } catch {
    return buildResult(agentId, overlay, 'not-installed', null, false)
  }

  const parsed = parseSpawnCommand(command)

  if (parsed.npxBased) {
    const pkg = parseNpxPackageName(command)
    const cached = pkg ? await npxProbe(pkg).catch(() => false) : false
    return buildResult(
      agentId,
      overlay,
      cached ? 'installed' : 'npx-available',
      null,
      true,
    )
  }

  const result = await withTimeout(binProbe(parsed.bin), timeoutMs).catch(
    () => ({ found: false, version: null }),
  )
  return buildResult(
    agentId,
    overlay,
    result.found ? 'installed' : 'not-installed',
    result.version,
    false,
  )
}

function buildResult(
  agentId: string,
  overlay: AcpAgentDisplayMeta,
  installState: AcpInstallState,
  version: string | null,
  npxBased: boolean,
): AcpAgentDetection {
  return {
    agentId,
    displayName: overlay.displayName,
    installState,
    version,
    installUrl: overlay.installUrl,
    acpReady: installState !== 'not-installed',
    npxBased,
  }
}

/** `command -v <bin>` followed by `<bin> --version`. */
async function probeBinary(
  bin: string,
): Promise<{ found: boolean; version: string | null }> {
  const lookup = await runCommand('command', ['-v', bin]).catch(() => null)
  const found = !!(
    lookup &&
    lookup.code === 0 &&
    lookup.stdout.trim().length > 0
  )
  if (!found) return { found: false, version: null }

  const versionResult = await runCommand(bin, ['--version']).catch(() => null)
  const version =
    versionResult && versionResult.code === 0
      ? (versionResult.stdout.trim().split('\n')[0] ?? null)
      : null
  return { found: true, version: version || null }
}

interface CommandResult {
  code: number
  stdout: string
  stderr: string
}

function runCommand(cmd: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    // `command -v` is a shell builtin — invoke through `sh -c` for it.
    const child =
      cmd === 'command'
        ? spawn('sh', ['-c', `command -v ${args[1]}`])
        : spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.once('error', reject)
    child.once('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Probe timed out after ${ms}ms`)),
        ms,
      )
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
