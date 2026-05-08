/**
 * Display + install metadata overlay for ACP agents enumerated from
 * acpx's runtime registry.
 *
 * The source of truth for *which* agents exist is acpx itself
 * (`createAgentRegistry().list()`). This file adds the human-facing
 * details acpx doesn't ship (display name, install URL) keyed by the
 * same agent id. Agents not listed here render with a generic fallback
 * — adding a pretty row is one entry per agent.
 */

export interface AcpAgentDisplayMeta {
  displayName: string
  installUrl: string
}

const ACP_AGENT_DISPLAY: Record<string, AcpAgentDisplayMeta> = {
  claude: {
    displayName: 'Claude Code',
    installUrl: 'https://docs.anthropic.com/en/docs/claude-code/overview',
  },
  codex: {
    displayName: 'Codex CLI',
    installUrl: 'https://github.com/openai/codex',
  },
  gemini: {
    displayName: 'Gemini CLI',
    installUrl: 'https://github.com/google-gemini/gemini-cli',
  },
  hermes: {
    displayName: 'Hermes Agent',
    installUrl: 'https://hermes-agent.nousresearch.com/',
  },
}

export function getDisplayMeta(agentId: string): AcpAgentDisplayMeta {
  const overlay = ACP_AGENT_DISPLAY[agentId]
  if (overlay) return overlay
  return {
    displayName: agentId,
    installUrl: 'https://github.com/openclaw/acpx',
  }
}

/**
 * Parse an acpx spawn command into something we can probe.
 *
 * acpx's `registry.resolve(agentId)` returns command strings like:
 *   - `npx -y @agentclientprotocol/claude-agent-acp@^0.31.0`
 *   - `gemini --acp`
 *   - `hermes acp`
 *
 * For npx-fronted agents we probe the npx cache to know whether the
 * package is on disk (truly installed) or will be fetched at first use.
 * For everything else, the first token is the binary that must be on
 * PATH for the agent to start.
 */
export interface ParsedSpawnCommand {
  npxBased: boolean
  /** First token — only meaningful when !npxBased. */
  bin: string
}

export function parseSpawnCommand(command: string): ParsedSpawnCommand {
  const tokens = command.trim().split(/\s+/)
  const head = tokens[0] ?? ''
  if (head === 'npx' || head === 'npm' || head === 'pnpm' || head === 'yarn') {
    return { npxBased: true, bin: head }
  }
  return { npxBased: false, bin: head }
}

/**
 * Extract the npm package name from an `npx`-fronted command.
 *
 * Examples:
 *   `npx -y @agentclientprotocol/claude-agent-acp@^0.31.0`
 *     → `@agentclientprotocol/claude-agent-acp`
 *   `npx pi-acp@^0.0.26` → `pi-acp`
 *   `npx -y @kilocode/cli acp` → `@kilocode/cli`
 *   `gemini --acp` → null (not npx)
 *
 * Scoped names (leading `@`) keep the prefix. The trailing `@<spec>`
 * version pin is stripped — we look for an `@` at index > 0 because
 * the leading `@` of a scoped name is always at index 0.
 */
export function parseNpxPackageName(command: string): string | null {
  const tokens = command.trim().split(/\s+/)
  if (tokens[0] !== 'npx') return null
  // First non-flag positional after `npx`. Skips `-y` / `--yes` / etc.
  const pkgIndex = tokens.findIndex(
    (token, idx) => idx > 0 && !token.startsWith('-'),
  )
  if (pkgIndex < 0) return null
  const raw = tokens[pkgIndex] ?? ''
  if (!raw) return null
  const lastAt = raw.lastIndexOf('@')
  if (lastAt > 0) return raw.slice(0, lastAt)
  return raw
}
