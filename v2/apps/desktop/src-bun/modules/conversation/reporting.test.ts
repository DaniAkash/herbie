import { describe, expect, test } from 'bun:test'
import { briefDocument, briefVersion } from '@bun/modules/conversation/brief'
import {
  REPORTING_TOOL_NAMES,
  type ReportingContext,
  reportingTools,
} from '@bun/modules/conversation/reporting'
import type { DraftRecord, TranscriptRecord } from '@bun/shared/transcript'

function harness(
  answers: Record<string, readonly number[]> = {},
): ReportingContext & {
  written: DraftRecord[]
  activity: string[]
} {
  const written: DraftRecord[] = []
  const activity: string[] = []
  return {
    written,
    activity,
    append: (draft) => {
      written.push(draft)
      return {
        seq: written.length,
        id: `r_${written.length}`,
        at: '2026-11-04T00:00:00.000Z',
        turn: 't_1',
        ...draft,
      } as TranscriptRecord
    },
    awaitAnswers: async () => answers,
    setActivity: (text) => {
      activity.push(text)
    },
  }
}

describe('the reporting vocabulary', () => {
  test('is exactly the nine tools the brief names', () => {
    const tools = reportingTools(harness())
    expect(Object.keys(tools).sort()).toEqual([...REPORTING_TOOL_NAMES].sort())
  })

  test('declares a schema the agent can read, closed to extra keys', () => {
    for (const [name, tool] of Object.entries(reportingTools(harness()))) {
      expect(tool.inputSchema.type, name).toBe('object')
      expect(tool.inputSchema.additionalProperties, name).toBe(false)
      // The description is the contract on a runtime with no system prompt,
      // so an empty one is a broken tool rather than a tidy one.
      expect(tool.description.length, name).toBeGreaterThan(80)
    }
  })

  test('say writes the block it was given', async () => {
    const ctx = harness()
    const result = await reportingTools(ctx).say?.execute(
      { text: 'Five drafts. Two are worth posting.' },
      context(),
    )
    expect(result).toBe('shown')
    expect(ctx.written).toEqual([
      { kind: 'say', text: 'Five drafts. Two are worth posting.' },
    ])
  })

  test('set_activity changes the label without writing a block', async () => {
    const ctx = harness()
    await reportingTools(ctx).set_activity?.execute(
      { text: 'Reading the feed' },
      context(),
    )
    expect(ctx.activity).toEqual(['Reading the feed'])
    expect(ctx.written).toEqual([])
  })

  test('ask blocks, then answers in the words the agent wrote', async () => {
    const ctx = harness({ '0': [1] })
    const result = await reportingTools(ctx).ask?.execute(
      {
        questions: [
          { q: 'Post it now?', type: 'radio', options: ['Post', 'Hold'] },
        ],
      },
      context(),
    )
    expect(result).toBe('Post it now? Hold')
    expect(ctx.written[0]).toMatchObject({ kind: 'ask', answers: null })
  })

  test('show_tasks refuses the status that animates itself', () => {
    const tool = reportingTools(harness()).show_tasks
    expect(() =>
      tool?.execute(
        { rows: [{ label: 'Draft', status: 'sequence' }] },
        context(),
      ),
    ).toThrow()
  })

  test('show_insight refuses a chart kind nothing renders', () => {
    const tool = reportingTools(harness()).show_insight
    expect(() =>
      tool?.execute(
        {
          title: 'Reach',
          pages: [
            {
              kind: 'sankey',
              heading: 'Flow',
              prose: 'where it went',
              series: [
                { label: 'a', value: 1 },
                { label: 'b', value: 2 },
              ],
            },
          ],
        },
        context(),
      ),
    ).toThrow()
  })

  test('a tool rejects an argument of the wrong type', () => {
    // The provider validates too, and this is the second line: a number that
    // got through would otherwise be written into the transcript as one and
    // break the renderer rather than the call.
    const tool = reportingTools(harness()).say
    expect(() => tool?.execute({ text: 42 }, context())).toThrow()
  })
})

describe('the brief', () => {
  const input = {
    name: 'Postman',
    brief: 'Draft social posts from my GitHub activity.',
    autonomy: 'ask',
    rules: [
      { kind: 'ask', phrase: 'posting anything publicly' },
      { kind: 'allow', phrase: 'reading my repositories' },
    ],
  }

  test('carries the reporting rule, the brief and both rule kinds', () => {
    const document = briefDocument(input)
    expect(document).toContain('How you report')
    expect(document).toContain('Draft social posts')
    expect(document).toContain('posting anything publicly')
    expect(document).toContain('reading my repositories')
    for (const name of REPORTING_TOOL_NAMES) {
      expect(document).toContain(name)
    }
  })

  test('says the agent may not act alone when autonomy is ask', () => {
    expect(briefDocument(input)).toContain('not yet trusted')
    expect(briefDocument({ ...input, autonomy: 'auto' })).toContain(
      'may act without waiting',
    )
  })

  test('versions on everything a session freezes at creation', () => {
    const before = briefVersion(input)
    expect(briefVersion(input)).toBe(before)
    expect(briefVersion({ ...input, brief: 'Something else.' })).not.toBe(
      before,
    )
    expect(briefVersion({ ...input, autonomy: 'auto' })).not.toBe(before)
    expect(briefVersion({ ...input, rules: [] })).not.toBe(before)
  })
})

function context() {
  return {
    abortSignal: new AbortController().signal,
    sessionKey: 'postman:abc',
    toolCallId: 'call_1',
  }
}
