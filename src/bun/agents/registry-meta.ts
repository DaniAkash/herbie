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

export interface ParsedSpawnCommand {
  npxBased: boolean
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

export function parseNpxPackageName(command: string): string | null {
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
