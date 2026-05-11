import type { AgentInfo, InboxItem, Workspace } from './herbie-data.types'

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
