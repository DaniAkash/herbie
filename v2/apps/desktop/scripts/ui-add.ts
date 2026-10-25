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
import { mkdir, readdir, rename, rmdir } from 'node:fs/promises'
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
