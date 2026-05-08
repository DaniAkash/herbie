// Display name + install URL overlay for ACP agents enumerated by acpx.
// acpx itself only exposes agent IDs; the human-facing copy lives here.

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
  copilot: {
    displayName: 'GitHub Copilot CLI',
    installUrl: 'https://github.com/github/gh-copilot',
  },
  cursor: {
    displayName: 'Cursor CLI',
    installUrl: 'https://docs.cursor.com/en/cli/overview',
  },
  droid: {
    displayName: 'Droid CLI',
    installUrl: 'https://docs.factory.ai/cli/getting-started/overview',
  },
  iflow: {
    displayName: 'iFlow CLI',
    installUrl: 'https://www.npmjs.com/package/@iflow-ai/iflow-cli',
  },
  kilocode: {
    displayName: 'Kilo Code',
    installUrl: 'https://kilocode.ai/',
  },
  kimi: {
    displayName: 'Kimi CLI',
    installUrl: 'https://github.com/MoonshotAI/kimi-cli',
  },
  kiro: {
    displayName: 'Kiro',
    installUrl: 'https://kiro.dev/',
  },
  openclaw: {
    displayName: 'OpenClaw',
    installUrl: 'https://github.com/openclaw/openclaw',
  },
  opencode: {
    displayName: 'OpenCode',
    installUrl: 'https://opencode.ai/',
  },
  pi: {
    displayName: 'Pi',
    installUrl: 'https://www.npmjs.com/package/pi-acp',
  },
  qoder: {
    displayName: 'Qoder',
    installUrl: 'https://qoder.com/',
  },
  qwen: {
    displayName: 'Qwen Code',
    installUrl: 'https://github.com/QwenLM/qwen-code',
  },
  trae: {
    displayName: 'Trae',
    installUrl: 'https://www.trae.ai/',
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
