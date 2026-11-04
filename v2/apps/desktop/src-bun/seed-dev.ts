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
import { openTranscript } from '@bun/modules/conversation/transcript'
import { openDb } from '@bun/modules/db/db'
import {
  agents,
  agentTools,
  mcpServers,
  routines,
  skills,
  transcriptCursors,
} from '@bun/modules/db/schema/schema'
import { toCron } from '@bun/modules/routines/cadence'
import { AGENTS, ROUTINES } from '@bun/seed-dev.data'
import { OTHER_THREADS, POSTMAN_THREAD } from '@bun/seed-dev.thread'

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

/*
 * Threads are files in each agent's own folder, not rows, so this writes
 * them the way a turn would. The cursor row is written alongside because
 * that is what the rail reads to know a thread has anything in it.
 */
for (const [id, records] of [
  ['postman', POSTMAN_THREAD] as const,
  ...Object.entries(OTHER_THREADS),
]) {
  const transcript = openTranscript(agentDir(id))
  let turn = 0
  for (const record of records) {
    if (record.kind === 'user') turn += 1
    transcript.append(`t_seed${turn || 1}`, record)
  }
  db.insert(transcriptCursors)
    .values({
      agentId: id,
      lastSeq: transcript.lastSeq,
      lastAt: new Date().toISOString(),
      unreadFrom: null,
    })
    .onConflictDoNothing()
    .run()
}

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

log.info('seed written', {
  agents: AGENTS.length,
  blocks: POSTMAN_THREAD.length,
})
