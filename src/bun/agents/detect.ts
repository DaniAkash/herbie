import { spawn } from 'node:child_process'
import { createAgentRegistry } from 'acpx/runtime'
import { type AcpAgentDisplayMeta, getDisplayMeta } from './agent-display'
import { probeNpxCache } from './npx-cache'

export type AcpInstallState = 'installed' | 'npx-available' | 'not-installed'

export interface AcpAgentDetection {
  agentId: string
  displayName: string
  installState: AcpInstallState
  version: string | null
  installUrl: string
  acpReady: boolean
  npxBased: boolean
}

const PROBE_TIMEOUT_MS = 3_000

const STATE_ORDER: Record<AcpInstallState, number> = {
  installed: 0,
  'npx-available': 1,
  'not-installed': 2,
}

const registry = createAgentRegistry({
  overrides: { hermes: 'hermes acp' },
})

export interface DetectAgentsOptions {
  binProbeOverride?: (
    bin: string,
    timeoutMs: number,
  ) => Promise<{ found: boolean; version: string | null }>
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

  const result = await binProbe(parsed.bin, timeoutMs).catch(() => ({
    found: false,
    version: null,
  }))
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

async function probeBinary(
  bin: string,
  timeoutMs: number,
): Promise<{ found: boolean; version: string | null }> {
  const lookup = await runCommand('command', ['-v', bin], timeoutMs).catch(
    () => null,
  )
  const found = !!(
    lookup &&
    lookup.code === 0 &&
    lookup.stdout.trim().length > 0
  )
  if (!found) return { found: false, version: null }

  const versionResult = await runCommand(bin, ['--version'], timeoutMs).catch(
    () => null,
  )
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

function runCommand(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    // `command -v` is a shell builtin — invoke through `sh -c`.
    const child =
      cmd === 'command'
        ? spawn('sh', ['-c', `command -v ${args[1]}`])
        : spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`Probe timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

interface ParsedSpawnCommand {
  npxBased: boolean
  bin: string
}

function parseSpawnCommand(command: string): ParsedSpawnCommand {
  const tokens = command.trim().split(/\s+/)
  const head = tokens[0] ?? ''
  if (head === 'npx') return { npxBased: true, bin: head }
  return { npxBased: false, bin: head }
}

function parseNpxPackageName(command: string): string | null {
  const tokens = command.trim().split(/\s+/)
  if (tokens[0] !== 'npx') return null
  const pkgIndex = tokens.findIndex(
    (token, idx) => idx > 0 && !token.startsWith('-'),
  )
  if (pkgIndex < 0) return null
  const raw = tokens[pkgIndex] ?? ''
  if (!raw) return null
  // Strip trailing `@<spec>` version pin; leading `@` of scoped names is at index 0.
  const lastAt = raw.lastIndexOf('@')
  if (lastAt > 0) return raw.slice(0, lastAt)
  return raw
}
