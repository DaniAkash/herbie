/**
 * Sample agents, so the window has something to render in development.
 *
 * Writes only into an empty agents table, so running it twice is a no op and
 * it can never overwrite real work. Point HERBIE_STATE_DIR somewhere else to
 * keep it away from an install you care about.
 *
 *   bun run seed:dev
 */

import { agentDir } from '@bun/lib/env'
import { createLogger } from '@bun/lib/log'
import { openDb } from '@bun/modules/db/db'
import {
  agents,
  agentTools,
  mcpServers,
  messages,
  routines,
  skills,
} from '@bun/modules/db/schema/schema'
import { toCron } from '@bun/modules/routines/cadence'
import { AGENTS, ROUTINES } from '@bun/seed-dev.data'

const log = createLogger('seed')

const { db } = openDb()

if (db.select().from(agents).all().length > 0) {
  log.info('agents already exist, nothing written')
  process.exit(0)
}

db.insert(agents)
  .values(
    AGENTS.map((a) => ({
      ...a,
      workspaceDir: agentDir(a.id),
      effort: 'medium',
    })),
  )
  .run()

// Derived here rather than written out, for the same reason the route
// derives it: a seeded schedule with no cron is one the panel has to show
// as never firing, and a development install that looks broken on first
// run teaches the wrong thing.
db.insert(routines)
  .values(
    ROUTINES.map((routine) => ({
      ...routine,
      cron:
        routine.kind === 'schedule'
          ? (toCron(routine.cadence)?.cron ?? null)
          : null,
    })),
  )
  .run()

db.insert(messages)
  .values([
    // Postman's thread covers every state the conversation can render: a
    // routine-started divider, agent and user turns, a tool call, a long
    // reply, a question it is waiting on, a failure, and live thinking.
    {
      id: 'm1',
      agentId: 'postman',
      role: 'divider',
      body: 'Postman started this at five',
    },
    {
      id: 'm2',
      agentId: 'postman',
      role: 'agent',
      body: 'Five drafts are ready. Nothing is posted or queued.',
    },
    {
      id: 'm3',
      agentId: 'postman',
      role: 'user',
      body: 'The first one works better as a quote post. Rewrite it that way and hold the rest.',
    },
    {
      id: 'm4',
      agentId: 'postman',
      role: 'tool',
      body: 'Opened the original post',
    },
    {
      id: 'm5',
      agentId: 'postman',
      role: 'agent',
      body: 'Rewritten as a quote post. The other four are held and will not go out until you say so.',
    },
    {
      id: 'm6',
      agentId: 'postman',
      role: 'user',
      body: 'Why not just link it on Bluesky as well?',
    },
    {
      id: 'm7',
      agentId: 'postman',
      role: 'agent',
      body: 'Bluesky renders an x.com link as a bare card with no title, image or description, so the post reads as a dead rectangle in the timeline. On X the same link expands properly because the post is native. My suggestion is to put the quote text on its own over there and keep the link for X only. If you would rather keep them identical I can do that instead, it just costs the preview.',
    },
    {
      id: 'm8',
      agentId: 'postman',
      role: 'tool',
      body: 'Read the Bluesky posting rules',
    },
    {
      id: 'm9',
      agentId: 'postman',
      role: 'question',
      body: 'Posting needs your approval. Shall I publish the quote post to X now?',
    },
    {
      id: 'm10',
      agentId: 'postman',
      role: 'user',
      body: 'Hold it until tomorrow morning.',
    },
    {
      id: 'm11',
      agentId: 'postman',
      role: 'agent',
      body: 'Held. I will raise it again at eight.',
    },
    {
      id: 'm12',
      agentId: 'postman',
      role: 'error',
      body: 'The X rate limit was hit while reading replies. Backing off for four minutes.',
    },
    {
      id: 'm13',
      agentId: 'postman',
      role: 'divider',
      body: 'Afternoon drafts, running now',
    },
    {
      id: 'm14',
      agentId: 'postman',
      role: 'thinking',
      body: 'Reading the feed and ranking what is worth a post',
    },

    {
      id: 'm20',
      agentId: 'ops',
      role: 'agent',
      body: 'Release notes drafted. Nine merged pull requests, grouped into three themes.',
    },
    {
      id: 'm21',
      agentId: 'scout',
      role: 'agent',
      body: 'Four pull requests need review. Two have failing checks, both on the same flaky job.',
    },
    {
      id: 'm22',
      agentId: 'inboxer',
      role: 'agent',
      body: 'Filed 23 messages. Four are flagged for you, the rest archived by rule.',
    },
    {
      id: 'm23',
      agentId: 'watchdog',
      role: 'agent',
      body: 'Could not reach the registry. I stopped before changing anything.',
    },
    {
      id: 'm24',
      agentId: 'watchdog',
      role: 'error',
      body: 'Four attempts failed in a row. Pausing myself until you look.',
    },
    {
      id: 'm25',
      agentId: 'housekeeper',
      role: 'agent',
      body: 'Guanciale, pecorino, eggs, black pepper.',
    },
  ])
  .run()

db.insert(mcpServers)
  .values([
    {
      id: 'playwright',
      name: 'playwright',
      kind: 'stdio',
      target: 'npx',
      args: '@playwright/mcp@latest',
      status: 'running',
    },
    {
      id: 'notion',
      name: 'notion',
      kind: 'http',
      target: 'https://mcp.notion.com/mcp',
      args: '',
      status: 'running',
    },
    {
      id: 'github',
      name: 'github',
      kind: 'stdio',
      target: 'npx',
      args: '@modelcontextprotocol/server-github',
      status: 'running',
    },
    {
      id: 'postgres',
      name: 'postgres',
      kind: 'stdio',
      target: 'npx',
      args: '@modelcontextprotocol/server-postgres',
      status: 'failed',
    },
  ])
  .run()

db.insert(skills)
  .values([
    {
      id: 'pr-review',
      name: 'pr-review',
      description: 'Triage a pull request against the house checklist',
    },
    {
      id: 'release-notes',
      name: 'release-notes',
      description: 'Turn merged pull requests into a changelog entry',
    },
    {
      id: 'repro-first',
      name: 'repro-first',
      description: 'Write a failing test before touching the fix',
    },
  ])
  .run()

db.insert(agentTools)
  .values([
    { agentId: 'postman', kind: 'server', refId: 'playwright', enabled: true },
    { agentId: 'postman', kind: 'server', refId: 'notion', enabled: true },
    { agentId: 'postman', kind: 'server', refId: 'github', enabled: false },
    { agentId: 'postman', kind: 'server', refId: 'postgres', enabled: false },
    { agentId: 'postman', kind: 'skill', refId: 'pr-review', enabled: false },
    {
      agentId: 'postman',
      kind: 'skill',
      refId: 'release-notes',
      enabled: false,
    },
    { agentId: 'postman', kind: 'skill', refId: 'repro-first', enabled: true },
  ])
  .run()

log.info('seed written', { agents: AGENTS.length })
