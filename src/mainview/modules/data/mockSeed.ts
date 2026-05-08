import type {
  AgentInfo,
  Conversation,
  InboxItem,
  Message,
  Task,
  Workspace,
} from './herbie-data.types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const now = Date.now()

export const seedAgents: AgentInfo[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    blurb: 'Best for code & refactors',
    status: 'ready',
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    blurb: 'Tight code edits, fast',
    status: 'ready',
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    blurb: 'Big context, exploration',
    status: 'signin-required',
  },
  {
    id: 'hermes',
    label: 'Hermes Agent',
    blurb: 'Long-running watchers',
    status: 'not-installed',
  },
]

export const seedWorkspaces: Workspace[] = [
  {
    id: 'browseros',
    name: 'browseros',
    path: '~/workbench/BrowserOS-ai/browseros',
    pinned: true,
  },
  {
    id: 'herbie',
    name: 'herbie',
    path: '~/workbench/DaniAkash/herbie',
    pinned: true,
  },
  {
    id: 'workstation',
    name: 'workstation',
    path: '~/workbench/DaniAkash/workstation',
  },
  {
    id: 'control-center',
    name: 'control-center',
    path: '~/Documents/Github/DaniAkash/control-center',
  },
]

export const seedConversations: Conversation[] = [
  {
    id: 'conv-refactor',
    title: 'Refactor agent runtime',
    defaultAgent: 'claude',
    workspaceId: 'browseros',
    origin: 'desktop',
    createdAt: now - 3 * HOUR,
    updatedAt: now - 2 * HOUR,
  },
  {
    id: 'conv-vision',
    title: 'Vision doc review',
    defaultAgent: 'claude',
    workspaceId: 'herbie',
    origin: 'desktop',
    createdAt: now - DAY,
    updatedAt: now - 22 * HOUR,
  },
  {
    id: 'conv-tunnel',
    title: 'Tunnel design Q',
    defaultAgent: 'gemini',
    workspaceId: 'herbie',
    origin: 'desktop',
    createdAt: now - 3 * DAY,
    updatedAt: now - 3 * DAY,
  },
  {
    id: 'conv-grocery',
    title: 'Grocery list for carbonara',
    defaultAgent: 'claude',
    origin: 'mobile',
    createdAt: now - 5 * DAY,
    updatedAt: now - 5 * DAY,
  },
]

export const seedMessages: Message[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-refactor',
    role: 'user',
    parts: [
      {
        type: 'text',
        text: 'the new ContainerAgentRuntime — does it still need the supervisor wrapper, or is the lifecycle now self-contained?',
      },
    ],
    createdAt: now - 3 * HOUR,
  },
  {
    id: 'msg-2',
    conversationId: 'conv-refactor',
    role: 'assistant',
    agent: 'claude',
    parts: [
      {
        type: 'reasoning',
        text: 'Reading apps/api/src/modules/agent-runtime/ContainerAgentRuntime.ts and comparing against the old SupervisedAgent pattern…',
      },
      {
        type: 'text',
        text: 'Yes — the container still owns the lifecycle, but the supervisor wrapper is gone. Lifecycle hooks moved into `ContainerAgentRuntime.start/stop`. The wrapper was redundant once the container started owning the AbortController.\n\nSo for new agents you just extend `ContainerAgentRuntime`. No supervisor needed.',
      },
    ],
    createdAt: now - 3 * HOUR + 2 * MINUTE,
  },
  {
    id: 'msg-3',
    conversationId: 'conv-refactor',
    role: 'user',
    parts: [
      { type: 'text', text: 'great — what about cancellation propagation?' },
    ],
    createdAt: now - 2 * HOUR,
  },
  {
    id: 'msg-4',
    conversationId: 'conv-refactor',
    role: 'assistant',
    agent: 'claude',
    parts: [
      {
        type: 'text',
        text: 'Cancellation flows from `AbortSignal` → `runtime.cancel()` → the underlying ACP child via `process.kill("SIGTERM")`. If the child ignores SIGTERM for 5s we follow up with SIGKILL.',
      },
    ],
    createdAt: now - 2 * HOUR + 30_000,
  },
  {
    id: 'msg-vision-1',
    conversationId: 'conv-vision',
    role: 'user',
    parts: [
      {
        type: 'text',
        text: 'does the v1 scope feel right? anything obviously missing?',
      },
    ],
    createdAt: now - DAY,
  },
  {
    id: 'msg-vision-2',
    conversationId: 'conv-vision',
    role: 'assistant',
    agent: 'claude',
    parts: [
      {
        type: 'text',
        text: 'The scope holds together. One thing worth flagging: the credentials-probe story is light — first-run UX hinges on it.',
      },
    ],
    createdAt: now - DAY + MINUTE,
  },
]

export const seedTasks: Task[] = [
  {
    id: 'task-morning-github',
    name: 'morning-github',
    prompt:
      'Summarise overnight GitHub activity across my repos. Group by repo, list notable PRs, mentions, and issues.',
    agent: 'hermes',
    workspaceId: undefined,
    schedule: { kind: 'daily', hour: 9, minute: 0 },
    outputs: ['inbox', 'telegram'],
    status: 'active',
    lastRunAt: now - 3 * HOUR,
    nextRunAt: now + 21 * HOUR,
    createdAt: now - 14 * DAY,
  },
  {
    id: 'task-sentry-watch',
    name: 'sentry-watch',
    prompt:
      'Check Sentry for new errors in the last 4 hours. Summarise by service. Flag anything affecting >5 users.',
    agent: 'claude',
    workspaceId: 'browseros',
    schedule: { kind: 'interval', hours: 4 },
    outputs: ['inbox'],
    status: 'active',
    lastRunAt: now - 2 * HOUR,
    nextRunAt: now + 2 * HOUR,
    createdAt: now - 7 * DAY,
  },
  {
    id: 'task-linear-weekly',
    name: 'linear-weekly',
    prompt:
      "Pull this week's Linear activity — issues closed, opened, blocked. One paragraph per project.",
    agent: 'hermes',
    workspaceId: undefined,
    schedule: { kind: 'weekly', weekday: 1, hour: 9, minute: 0 },
    outputs: ['inbox'],
    status: 'active',
    lastRunAt: now - 2 * DAY,
    nextRunAt: now + 5 * DAY,
    createdAt: now - 30 * DAY,
  },
  {
    id: 'task-prs-review',
    name: 'prs-needing-review',
    prompt:
      'List PRs in my repos that need review and have been open >24h. Sort by age.',
    agent: 'gemini',
    workspaceId: undefined,
    schedule: { kind: 'daily', hour: 8, minute: 0 },
    outputs: ['inbox'],
    status: 'paused',
    lastRunAt: now - 4 * DAY,
    createdAt: now - 21 * DAY,
  },
]

export const seedInboxItems: InboxItem[] = [
  {
    id: 'inbox-1',
    taskId: 'task-morning-github',
    taskName: 'morning-github',
    title: 'Daily GitHub digest',
    body: `12 PRs merged across 4 repos overnight.

**Notable:**
- **browseros** — tunnel CSRF fix landed (#312). Closes a long-standing security issue.
- **herbie** — vision doc + architecture draft pushed; UI/UX design followed.
- **workstation** — drizzle/sqlite local-first setup landed.
- **control-center** — 5 new plans added (Hermes phase 2, agent-runtime, BrowserOS Origin allowlist).

**Mentions:** 2 — both on browseros#312 thread.

**Open issues touched:** 3 — see linked digest in the workspace.`,
    agent: 'hermes',
    status: 'unread',
    starred: false,
    createdAt: now - 3 * HOUR,
  },
  {
    id: 'inbox-2',
    taskId: 'task-sentry-watch',
    taskName: 'sentry-watch',
    title: 'Sentry overnight',
    body: `1 new error in **browseros**:

\`\`\`
TypeError: cannot read properties of undefined (reading 'pipeline')
  at processChunk (pipeline.ts:142)
\`\`\`

- First seen: 02:14 UTC
- Affected users: 3
- Frequency: 7 events
- Linked PR: none yet

Looks like the new chunk-size guard skipped a null-check. Want me to open a fix PR?`,
    agent: 'claude',
    workspaceId: 'browseros',
    status: 'unread',
    starred: false,
    createdAt: now - 9 * HOUR,
  },
  {
    id: 'inbox-3',
    taskId: 'task-linear-weekly',
    taskName: 'linear-weekly',
    title: 'Linear weekly summary',
    body: `**This week across all projects:**

- **INGEST** — 4 issues closed, 2 opened. Pipeline health back to green after Tuesday's deploy.
- **AUTH** — 2 closed (the session-token compliance work). 0 opened.
- **MOBILE** — 1 closed, 1 opened. Release branch cuts Thursday.

No blocked issues. Velocity steady.`,
    agent: 'hermes',
    status: 'read',
    starred: true,
    createdAt: now - 3 * DAY,
  },
  {
    id: 'inbox-4',
    taskId: 'task-prs-review',
    taskName: 'prs-needing-review',
    title: 'PRs needing review',
    body: `3 PRs open >24h:

- **browseros#314** — disclosure-handling rules (open 38h, 1 review, blocked on Origin allowlist work)
- **herbie#1** — shadcn UI scaffold (open 26h)
- **workstation#42** — drizzle setup (open 31h)`,
    agent: 'gemini',
    status: 'read',
    starred: false,
    createdAt: now - 4 * DAY,
  },
]
