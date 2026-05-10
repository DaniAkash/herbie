import type { AgentInfo, InboxItem, Task, Workspace } from './herbie-data.types'

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
