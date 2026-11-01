/**
 * `shadcn add`, then put the stylesheets where this app keeps them.
 *
 * Every beautifui item depends on its `foundation`, whose file target is
 * hard-coded to `app/beautifui/foundation.css`, a path that assumes a Next.js
 * project. The CLI resolves it against whichever root it detects, so here it
 * lands in `src/app/beautifui/`, a directory this app has no other use for
 * and which reads as a stray Next.js app router to anyone browsing. Two more
 * items ship their own CSS to the same place, so this recurs rather than
 * being a one-off move.
 *
 *   bun run ui:add @beautifui/chat-composer
 *   bun run ui:add @beui/voice-orb
 */

import { existsSync } from 'node:fs'
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rmdir,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'
import { $ } from 'bun'
import { ok } from './output'

const root = join(import.meta.dir, '..')
// Both roots the CLI has been seen to resolve that hard-coded target against.
const STRAYS = [
  join(root, 'src', 'app', 'beautifui'),
  join(root, 'app', 'beautifui'),
]
const home = join(root, 'src', 'styles', 'beautifui')

const names = process.argv.slice(2)
if (names.length === 0) {
  throw new Error('usage: bun run ui:add @beautifui/<name> [@beui/<name> ...]')
}

await $`bunx --bun shadcn@latest add ${names}`.cwd(root)

let moved = 0
for (const stray of STRAYS) {
  if (!existsSync(stray)) continue
  await mkdir(home, { recursive: true })
  for (const file of await readdir(stray)) {
    await rename(join(stray, file), join(home, file))
    ok('relocated', join('src/styles/beautifui', file))
    moved += 1
  }
  await rmdir(stray)
  // Only if now empty. A real `app` directory would refuse, which is correct.
  await rmdir(join(stray, '..')).catch(() => {})
}

if (moved === 0) {
  ok('nothing to relocate')
} else {
  ok('remember', 'a new stylesheet needs an @import in src/index.css')
}

/*
 * Vendored components are not written against this project's settings.
 *
 * Both registries ship implicit `any` on event parameters and indexed access
 * that `noUncheckedIndexedAccess` rejects, so a fresh install fails `tsc -b`
 * on roughly a fifth of its files. Patching each one loses the next time that
 * component is installed, which is why this happens here instead.
 *
 * The banner suppresses checking inside the file only. Exported types are
 * still inferred, so every call site in our own code stays fully checked.
 */
const BANNER = [
  '// @ts-nocheck',
  '/* Vendored from a component registry. Checking is off because upstream is',
  " * not written against this project's strict settings, and any fix here is",
  ' * lost the next time `bun run ui:add` installs it. Do not edit; reinstall.',
  ' */',
  '',
].join('\n')

const VENDOR_DIRS = [
  join(root, 'src', 'components', 'atoms'),
  join(root, 'src', 'components', 'motion'),
  join(root, 'src', 'components', 'primitives'),
  join(root, 'src', 'components', 'agents'),
  join(root, 'src', 'lib', 'hooks'),
]

async function stamp(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0
  let count = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      count += await stamp(path)
      continue
    }
    if (!/\.tsx?$/.test(entry.name)) continue
    const body = await readFile(path, 'utf8')
    if (body.startsWith('// @ts-nocheck')) continue
    await writeFile(path, BANNER + body)
    count += 1
  }
  return count
}

let stamped = 0
for (const dir of VENDOR_DIRS) stamped += await stamp(dir)
ok('stamped', `${stamped} vendored files`)

/*
 * foundation.css ships an orphaned rule and a stray closing brace that stop
 * Tailwind parsing the file. The repository keeps a patched copy; every
 * install overwrites it, so put it back rather than leaving a broken build
 * for whoever runs the next one.
 */
const foundation = join(home, 'foundation.css')
const patched = join(root, 'src', 'styles', 'beautifui', 'foundation.patch.css')
if (existsSync(patched) && existsSync(foundation)) {
  await writeFile(foundation, await readFile(patched, 'utf8'))
  ok('restored', 'foundation.css from foundation.patch.css')
}
