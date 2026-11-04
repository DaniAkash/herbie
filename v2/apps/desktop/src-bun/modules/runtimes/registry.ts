import { AGENT_REGISTRY } from 'acpx/agent-registry'

/**
 * Human facing copy for the coding agents acpx knows how to launch.
 *
 * acpx itself only carries ids and commands. A runtime with no entry here is
 * still offered, under its id, rather than being hidden: a new agent landing
 * in acpx should show up the day it does, not the day this map is updated.
 */
const DISPLAY: Record<string, { name: string; installUrl: string }> = {
  claude: {
    name: 'Claude Code',
    installUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
  },
  codex: { name: 'Codex CLI', installUrl: 'https://github.com/openai/codex' },
  gemini: {
    name: 'Gemini CLI',
    installUrl: 'https://github.com/google-gemini/gemini-cli',
  },
  copilot: {
    name: 'GitHub Copilot CLI',
    installUrl: 'https://github.com/github/copilot-cli',
  },
  cursor: {
    name: 'Cursor CLI',
    installUrl: 'https://docs.cursor.com/en/cli/overview',
  },
  droid: {
    name: 'Droid CLI',
    installUrl: 'https://docs.factory.ai/cli/getting-started/overview',
  },
  opencode: { name: 'OpenCode', installUrl: 'https://opencode.ai/' },
  openclaw: {
    name: 'OpenClaw',
    installUrl: 'https://github.com/openclaw/openclaw',
  },
  qwen: {
    name: 'Qwen Code',
    installUrl: 'https://github.com/QwenLM/qwen-code',
  },
  kimi: {
    name: 'Kimi CLI',
    installUrl: 'https://github.com/MoonshotAI/kimi-cli',
  },
  iflow: {
    name: 'iFlow CLI',
    installUrl: 'https://www.npmjs.com/package/@iflow-ai/iflow-cli',
  },
  kilocode: { name: 'Kilo Code', installUrl: 'https://kilocode.ai/' },
  kiro: { name: 'Kiro', installUrl: 'https://kiro.dev/' },
  qoder: { name: 'Qoder', installUrl: 'https://qoder.com/' },
  pi: { name: 'Pi', installUrl: 'https://www.npmjs.com/package/pi-acp' },
}

export interface RuntimeCandidate {
  readonly id: string
  readonly displayName: string
  readonly installUrl: string
  /** The command acpx would launch, as written in its registry. */
  readonly command: string
}

function titleCase(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/** Every coding agent this build can offer, in display order. */
export function candidates(): readonly RuntimeCandidate[] {
  return Object.entries(AGENT_REGISTRY)
    .map(([id, command]) => ({
      id,
      displayName: DISPLAY[id]?.name ?? titleCase(id),
      installUrl: DISPLAY[id]?.installUrl ?? '',
      command: Array.isArray(command) ? command.join(' ') : String(command),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function candidate(id: string): RuntimeCandidate | undefined {
  return candidates().find((c) => c.id === id)
}
