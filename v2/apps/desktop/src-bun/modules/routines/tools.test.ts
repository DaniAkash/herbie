import { beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { briefDocument } from '@bun/modules/conversation/brief'
import type { Db } from '@bun/modules/db/db'
import { openDb } from '@bun/modules/db/db'
import { agents, routines } from '@bun/modules/db/schema/schema'
import { matches } from '@bun/modules/loop/schedule'
import {
  nextRun,
  ROUTINE_TOOL_NAMES,
  type RoutineView,
  routineTools,
} from '@bun/modules/routines/tools'
import type { AcpxHostTool } from 'acpx-ai-provider'

let db: Db
let tools: Record<string, AcpxHostTool>

/** Wednesday 2026-11-04, 08:00 local. */
const NOW = new Date(2026, 10, 4, 8, 0, 0, 0).getTime()

const context = {
  abortSignal: new AbortController().signal,
  sessionKey: 'scout:v1',
  toolCallId: 'call_1',
}

function call(name: string, input: Record<string, unknown> = {}): unknown {
  const tool = tools[name]
  if (!tool) throw new Error(`no tool named ${name}`)
  return tool.execute(input, context)
}

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'herbie-rtools-'))
  db = openDb(join(dir, 'herbie.sqlite')).db
  db.insert(agents)
    .values({
      id: 'scout',
      name: 'Scout',
      acpAgent: 'codex',
      workspaceDir: '/tmp/scout',
    })
    .run()
  tools = routineTools({ db, agentId: 'scout', now: () => NOW })
})

describe('the tool set', () => {
  test('is the five the brief names', () => {
    expect(Object.keys(tools).sort()).toEqual([...ROUTINE_TOOL_NAMES].sort())
  })

  test('every one has a schema the agent can be handed', () => {
    for (const name of ROUTINE_TOOL_NAMES) {
      expect(tools[name]?.inputSchema).toBeDefined()
      expect(tools[name]?.description.length).toBeGreaterThan(80)
    }
  })
})

describe('creating a routine', () => {
  test('stores the words and the cron, and says when it next runs', () => {
    const made = call('create_routine', {
      name: 'Morning notifications',
      cadence: 'every weekday at 9',
      prompt: 'Check my notifications and say what needs a reply.',
    }) as RoutineView

    expect(made.name).toBe('Morning notifications')
    expect(made.reading).toBe('Monday to Friday at 9am')
    expect(made.enabled).toBe(true)
    // 08:00 Wednesday, so the next one is 09:00 the same day.
    expect(made.nextRunAt).toBe(new Date(2026, 10, 4, 9, 0).toISOString())

    const row = db.select().from(routines).all()[0]
    expect(row?.cron).toBe('0 9 * * 1-5')
    expect(row?.cadence).toBe('every weekday at 9')
  })

  test('refuses a cadence it cannot read, and saves nothing', () => {
    expect(() =>
      call('create_routine', {
        name: 'Whenever',
        cadence: 'sometime soonish',
        prompt: 'Do the thing.',
      }),
    ).toThrow(/could not read/i)

    // The refusal matters because the alternative is a row that never fires.
    expect(db.select().from(routines).all()).toHaveLength(0)
  })

  test('refuses an empty prompt rather than scheduling nothing', () => {
    expect(() =>
      call('create_routine', {
        name: 'Empty',
        cadence: 'every day at 9',
        prompt: '',
      }),
    ).toThrow()
  })
})

describe('changing one', () => {
  function seed(): string {
    const made = call('create_routine', {
      name: 'Morning notifications',
      cadence: 'every weekday at 9',
      prompt: 'Check notifications.',
    }) as RoutineView
    return made.id
  }

  test('moves the cadence and the cron together', () => {
    const id = seed()
    const after = call('update_routine', {
      id,
      cadence: 'every weekday at 7',
    }) as RoutineView

    expect(after.reading).toBe('Monday to Friday at 7am')
    expect(db.select().from(routines).all()[0]?.cron).toBe('0 7 * * 1-5')
  })

  test('leaves everything alone when the new cadence does not parse', () => {
    const id = seed()
    expect(() =>
      call('update_routine', { id, cadence: 'at some point' }),
    ).toThrow(/could not read/i)

    expect(db.select().from(routines).all()[0]?.cron).toBe('0 9 * * 1-5')
  })

  test('turns one off without losing it', () => {
    const id = seed()
    const off = call('set_routine_enabled', {
      id,
      enabled: false,
    }) as RoutineView

    expect(off.enabled).toBe(false)
    expect(off.nextRunAt).toBeNull()
    expect(db.select().from(routines).all()).toHaveLength(1)
  })

  test('deletes one for good', () => {
    const id = seed()
    expect(call('delete_routine', { id })).toEqual({
      deleted: true,
      name: 'Morning notifications',
    })
    expect(db.select().from(routines).all()).toHaveLength(0)
  })

  test('refuses to touch a routine belonging to another agent', () => {
    db.insert(agents)
      .values({
        id: 'other',
        name: 'Other',
        acpAgent: 'codex',
        workspaceDir: '/tmp/other',
      })
      .run()
    db.insert(routines)
      .values({
        id: 'theirs',
        agentId: 'other',
        name: 'Not yours',
        cadence: 'every day at 9',
        cron: '0 9 * * *',
        prompt: 'x',
      })
      .run()

    for (const call2 of [
      () => call('update_routine', { id: 'theirs', name: 'Mine now' }),
      () => call('set_routine_enabled', { id: 'theirs', enabled: false }),
      () => call('delete_routine', { id: 'theirs' }),
    ]) {
      expect(call2).toThrow(/no routine of yours/i)
    }
    expect(db.select().from(routines).all()).toHaveLength(1)
  })
})

describe('listing them', () => {
  test('returns only this agent, with what it needs to answer', () => {
    call('create_routine', {
      name: 'Morning notifications',
      cadence: 'every weekday at 9',
      prompt: 'Check notifications.',
    })

    const listed = call('list_routines') as { routines: RoutineView[] }
    expect(listed.routines).toHaveLength(1)
    expect(listed.routines[0]?.reading).toBe('Monday to Friday at 9am')
    expect(listed.routines[0]?.lastRunAt).toBeNull()
  })
})

describe('the next run time', () => {
  test('is a minute the loop would actually fire on', () => {
    // One matcher in the codebase, so what the person is told and what runs
    // cannot disagree. This is the assertion that keeps it that way.
    const at = nextRun('0 9 * * 1-5', NOW)
    expect(at).not.toBeNull()
    if (at) expect(matches('0 9 * * 1-5', Date.parse(at))).toBe(true)
  })

  test('is nothing when the cadence never parsed', () => {
    expect(nextRun(null, NOW)).toBeNull()
  })
})

describe('the brief', () => {
  test('tells the agent it manages routines by talking', () => {
    const document = briefDocument({
      name: 'Scout',
      brief: 'Watch the repositories.',
      rules: [],
      autonomy: 'ask',
    })

    expect(document).toContain('Work you do on your own')
    for (const name of ROUTINE_TOOL_NAMES) expect(document).toContain(name)
    // The judgement the tool descriptions cannot carry.
    expect(document).toContain('never create one silently')
  })
})
