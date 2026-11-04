import { describe, expect, test } from 'bun:test'
import { existsSync, lstatSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runtimeHome } from '@bun/modules/conversation/runtime-home'

function workspace(): string {
  return mkdtempSync(join(tmpdir(), 'herbie-home-'))
}

describe('a private config home', () => {
  test('points codex at its own directory inside the agent folder', () => {
    const dir = workspace()
    const { env } = runtimeHome('codex', dir)
    expect(env.CODEX_HOME).toBe(join(dir, '.herbie', 'codex'))
    expect(existsSync(join(dir, '.herbie', 'codex', 'config.toml'))).toBe(true)
  })

  // Asked for, not yet effective: the ACP adapter's session mode sets the
  // reviewer after config is read. The assertion covers what this file
  // writes, which is all it controls.
  test('asks for the reviewer that leaves our permission surface in place', () => {
    const dir = workspace()
    const config = readFileSync(
      join(runtimeHome('codex', dir).env.CODEX_HOME ?? '', 'config.toml'),
      'utf8',
    )
    expect(config).toContain('approvals_reviewer = "user"')
  })

  test('declares nothing else, so no plugin or server is inherited', () => {
    const dir = workspace()
    const config = readFileSync(
      join(runtimeHome('codex', dir).env.CODEX_HOME ?? '', 'config.toml'),
      'utf8',
    )
    expect(config).not.toContain('[plugins')
    expect(config).not.toContain('[mcp_servers')
    expect(config).not.toContain('[marketplaces')
  })

  test('links the login rather than copying it', () => {
    // A copy would go stale on the next token refresh, and would be a second
    // set of someone's credentials sitting on disk.
    const dir = workspace()
    const home = runtimeHome('codex', dir).env.CODEX_HOME ?? ''
    const auth = join(home, 'auth.json')
    expect(lstatSync(auth).isSymbolicLink()).toBe(true)
  })

  test('runs twice over the same folder without failing', () => {
    const dir = workspace()
    expect(runtimeHome('codex', dir).env.CODEX_HOME).toBe(
      runtimeHome('codex', dir).env.CODEX_HOME,
    )
  })

  test('leaves a runtime it does not know how to configure alone', () => {
    // Guessing at another agent's layout would break its auth, which is a
    // worse outcome than inheriting the machine's configuration.
    expect(runtimeHome('claude', workspace()).env).toEqual({})
  })
})
