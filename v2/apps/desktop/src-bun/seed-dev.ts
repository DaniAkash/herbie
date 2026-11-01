/**
 * Sample agents, so the window has something to render in development.
 *
 * Writes only into an empty agents table, so running it twice is a no op and
 * it can never overwrite real work. Point HERBIE_STATE_DIR somewhere else to
 * keep it away from an install you care about.
 *
 *   bun run seed:dev
 */

import { join } from 'node:path'
import { stateDir } from '@bun/lib/env'
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

const log = createLogger('seed')

const { db } = openDb()

if (db.select().from(agents).all().length > 0) {
  log.info('agents already exist, nothing written')
  process.exit(0)
}

const workspace = (id: string) => join(stateDir(), 'agents', id)

const AGENTS = [
  {
    id: 'ops',
    name: 'Ops',
    color: 'ops',
    acpAgent: 'claude',
    model: 'Opus 5',
    brief: 'You keep the repositories tidy and write the release notes.',
    state: 'idle',
    activity: null,
    telegramBot: '@ops_dani_bot',
  },
  {
    id: 'scout',
    name: 'Scout',
    color: 'scout',
    acpAgent: 'codex',
    model: 'GPT-5.2',
    brief: 'You read my GitHub notifications and tell me what needs a human.',
    state: 'working',
    activity: 'Reading fourteen GitHub notifications',
    telegramBot: '@scout_dani_bot',
  },
  {
    id: 'postman',
    name: 'Postman',
    color: 'post',
    acpAgent: 'claude',
    model: 'Opus 5',
    brief:
      'You write posts in my voice for X and Bluesky. Draft only, never publish. Prefer concrete numbers over adjectives, keep it lowercase, and skip the hashtags.',
    state: 'working',
    activity: "Drafting five posts from today's feed",
    telegramBot: '@postman_dani_bot',
  },
  {
    id: 'inboxer',
    name: 'Inboxer',
    color: 'mail',
    acpAgent: 'codex',
    model: 'GPT-5.2',
    brief: 'You file my mail and flag only what I have to answer myself.',
    state: 'idle',
    activity: null,
    telegramBot: '@inboxer_dani_bot',
  },
  {
    id: 'watchdog',
    name: 'Watchdog',
    color: 'watch',
    acpAgent: 'gemini',
    model: 'Gemini 3',
    brief:
      'You watch the dependency registry and open a pull request when something moves.',
    state: 'stuck',
    activity: 'Cannot reach the registry, trying again in four minutes',
    telegramBot: '@watchdog_dani_bot',
  },
  {
    id: 'housekeeper',
    name: 'Housekeeper',
    color: 'house',
    acpAgent: 'claude',
    model: 'Haiku 5.5',
    brief: 'You keep the shopping list and remind me what is running low.',
    state: 'off',
    activity: null,
    telegramBot: null,
  },
]

db.insert(agents)
  .values(
    AGENTS.map((a) => ({
      ...a,
      workspaceDir: workspace(a.id),
      effort: 'medium',
    })),
  )
  .run()

db.insert(routines)
  .values([
    {
      id: 'r1',
      agentId: 'postman',
      name: 'Morning scan',
      kind: 'schedule',
      cadence: 'Every day at eight',
      enabled: true,
    },
    {
      id: 'r2',
      agentId: 'postman',
      name: 'Afternoon drafts',
      kind: 'schedule',
      cadence: 'Every three hours until eight',
      enabled: true,
    },
    {
      id: 'r3',
      agentId: 'postman',
      name: 'Weekend recap',
      kind: 'schedule',
      cadence: 'Sundays at six',
      enabled: false,
    },
    {
      id: 'r4',
      agentId: 'postman',
      name: 'Reply suggestions',
      kind: 'event',
      cadence: 'When a post passes fifty replies',
      enabled: true,
    },
    {
      id: 'r5',
      agentId: 'ops',
      name: 'Release notes',
      kind: 'event',
      cadence: 'When a tag is pushed',
      enabled: true,
    },
    {
      id: 'r6',
      agentId: 'scout',
      name: 'Notification sweep',
      kind: 'schedule',
      cadence: 'Every hour',
      enabled: true,
    },
  ])
  .run()

db.insert(messages)
  .values([
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
      agentId: 'ops',
      role: 'agent',
      body: 'Release notes drafted. Nine merged pull requests, grouped into three themes.',
    },
    {
      id: 'm7',
      agentId: 'scout',
      role: 'agent',
      body: 'Four pull requests need review. Two have failing checks, both on the same flaky job.',
    },
    {
      id: 'm8',
      agentId: 'inboxer',
      role: 'agent',
      body: 'Filed 23 messages. Four are flagged for you, the rest archived by rule.',
    },
    {
      id: 'm9',
      agentId: 'watchdog',
      role: 'agent',
      body: 'Could not reach the registry. I stopped before changing anything.',
    },
    {
      id: 'm10',
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
