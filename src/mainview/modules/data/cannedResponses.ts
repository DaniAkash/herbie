import type { AgentId } from './herbie-data.types'

export const cannedResponses: Record<AgentId, string[]> = {
  claude: [
    'Looking at the relevant files now…\n\nThis looks like a clean refactor. The supervisor wrapper is what tied old agents to the lifecycle — once `ContainerAgentRuntime` owns the AbortController, the wrapper becomes redundant.',
    'Reading through the codebase. I see three places this pattern is used — happy to walk through them one at a time.',
    'Got it — I can open a PR for that. Want me to draft the description first or just push it?',
  ],
  codex: [
    'Done — patched in `src/modules/agent-runtime/index.ts`. The diff is small; the lifecycle hooks moved cleanly.',
    'Tightened the type — `ContainerAgentRuntime<T extends ChannelEvent>` now constrains correctly. Tests still green.',
  ],
  gemini: [
    'Reading the surrounding context (about 1.2M tokens). Give me a moment to land on a coherent plan.',
    "Here's the broader architectural picture across the repo. The piece you're touching is one of three coupled subsystems…",
  ],
  hermes: [
    "I'll watch this and report back hourly. First report due at the next interval — or I can run a one-shot now if you'd prefer.",
    'Task scheduled. Results will land in your inbox at the next run.',
  ],
}

export function pickResponse(agent: AgentId, seed: string): string {
  const pool = cannedResponses[agent] ?? cannedResponses.claude
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return pool[Math.abs(h) % pool.length]
}
