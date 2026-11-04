import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeBrief } from '@bun/modules/conversation/brief'
import {
  explainShape,
  recommendShape,
  showCodeShape,
} from '@bun/modules/conversation/reporting.schemas'

const source = (href: string) => ({
  text: 'An answer.',
  sources: [{ name: 'A', domain: 'a.io', href }],
})

const option = (label: string, recommended?: boolean) => ({
  label,
  detail: 'What it means.',
  confidence: 'fair' as const,
  ...(recommended === true ? { recommended: true } : {}),
})

describe('what the agent is allowed to report', () => {
  test('takes web links and refuses every other scheme', () => {
    expect(explainShape.safeParse(source('https://a.io/x')).success).toBe(true)
    expect(explainShape.safeParse(source('http://a.io/x')).success).toBe(true)
    expect(explainShape.safeParse(source('javascript:alert(1)')).success).toBe(
      false,
    )
    expect(explainShape.safeParse(source('file:///etc/passwd')).success).toBe(
      false,
    )
  })

  test('wants exactly one of code or diff, filled', () => {
    const row = { old: 1, cur: 1, type: 'ctx' as const, text: 'a' }
    expect(showCodeShape.safeParse({ filename: 'a.ts' }).success).toBe(false)
    expect(
      showCodeShape.safeParse({ filename: 'a.ts', code: '', diff: [] }).success,
    ).toBe(false)
    expect(
      showCodeShape.safeParse({ filename: 'a.ts', code: 'x', diff: [row] })
        .success,
    ).toBe(false)
    expect(
      showCodeShape.safeParse({ filename: 'a.ts', code: 'x' }).success,
    ).toBe(true)
    expect(
      showCodeShape.safeParse({ filename: 'a.ts', diff: [row] }).success,
    ).toBe(true)
  })

  test('wants exactly one recommended option', () => {
    const of = (...options: ReturnType<typeof option>[]) => ({
      title: 'Which?',
      options,
    })
    expect(recommendShape.safeParse(of(option('a'), option('b'))).success).toBe(
      false,
    )
    expect(
      recommendShape.safeParse(of(option('a', true), option('b', true)))
        .success,
    ).toBe(false)
    expect(
      recommendShape.safeParse(of(option('a', true), option('b'))).success,
    ).toBe(true)
  })
})

describe('the brief on disk', () => {
  const input = {
    name: 'Scout',
    brief: 'Watch the repositories.',
    rules: [],
    autonomy: 'ask' as const,
  }

  test('leaves instructions that were already in the workspace alone', () => {
    const dir = mkdtempSync(join(tmpdir(), 'herbie-brief-'))
    writeFileSync(join(dir, 'AGENTS.md'), '# House\n\nRun the tests.\n', 'utf8')

    writeBrief(dir, input)
    const after = readFileSync(join(dir, 'AGENTS.md'), 'utf8')
    expect(after).toContain('Run the tests.')
    expect(after).toContain('Watch the repositories.')
  })

  test('replaces its own section rather than stacking another one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'herbie-brief-'))
    writeFileSync(join(dir, 'CLAUDE.md'), 'Keep me.\n', 'utf8')

    writeBrief(dir, input)
    writeBrief(dir, { ...input, brief: 'Watch the issues instead.' })

    const after = readFileSync(join(dir, 'CLAUDE.md'), 'utf8')
    expect(after).toContain('Keep me.')
    expect(after).toContain('Watch the issues instead.')
    expect(after).not.toContain('Watch the repositories.')
    expect(after.split('herbie:begin').length - 1).toBe(1)
  })
})
