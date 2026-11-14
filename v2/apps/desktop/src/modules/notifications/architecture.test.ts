import { expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The notifier knows nothing about which coding agent it is talking about.
 *
 * Identity travels as data: a name, a colour and a shape off the agent row.
 * The moment a runtime is named in here, adding the next one means editing
 * this module too, and the seam the design is built on stops being a seam.
 * Enforced mechanically because it is the kind of rule a convenient special
 * case erodes one line at a time.
 */

const HERE = import.meta.dir
const TREES = [HERE, join(HERE, '../../../src-bun/modules/notifications')]

/** Every runtime acpx can launch, minus ids too short to match safely. */
const RUNTIMES = [
  'claude',
  'codex',
  'gemini',
  'copilot',
  'cursor',
  'droid',
  'opencode',
  'openclaw',
  'qwen',
  'kimi',
  'iflow',
  'kilocode',
  'kiro',
  'qoder',
]

function sources(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      found.push(...sources(path))
      continue
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) found.push(path)
  }
  return found
}

test('no runtime is named anywhere in the notification tree', () => {
  const offenders: string[] = []

  for (const tree of TREES) {
    for (const path of sources(tree)) {
      const text = readFileSync(path, 'utf8').toLowerCase()
      for (const runtime of RUNTIMES) {
        if (new RegExp(`\\b${runtime}\\b`).test(text)) {
          offenders.push(`${path} names ${runtime}`)
        }
      }
    }
  }

  expect(offenders).toEqual([])
})

test('both trees were actually read, so a rename cannot quietly pass it', () => {
  for (const tree of TREES) expect(sources(tree).length).toBeGreaterThan(0)
})
