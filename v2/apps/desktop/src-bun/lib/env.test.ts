import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { agentDir, isDev, stateDir } from '@bun/lib/env'

const ARGV = [...process.argv]
const DEV = process.env.HERBIE_DEV
const OVERRIDE = process.env.HERBIE_STATE_DIR

/** Assigning undefined to process.env stores the string "undefined". */
function unset(name: string): void {
  delete process.env[name]
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) unset(name)
  else process.env[name] = value
}

beforeEach(() => {
  process.argv = ARGV.filter((arg) => arg !== '--dev')
  unset('HERBIE_DEV')
  unset('HERBIE_STATE_DIR')
})

afterEach(() => {
  process.argv = [...ARGV]
  restore('HERBIE_DEV', DEV)
  restore('HERBIE_STATE_DIR', OVERRIDE)
})

describe('which install this is', () => {
  test('a release build keeps its state in the config home', () => {
    expect(isDev()).toBe(false)
    expect(stateDir()).toBe(join(homedir(), '.herbie'))
  })

  test('the flag the desktop shell passes makes it a dev build', () => {
    process.argv = [...process.argv, '--dev']
    expect(isDev()).toBe(true)
    expect(stateDir()).toBe(join(homedir(), '.herbie-dev'))
  })

  test('a terminal run says so with the environment instead', () => {
    process.env.HERBIE_DEV = '1'
    expect(stateDir()).toBe(join(homedir(), '.herbie-dev'))
  })

  test('the override wins over both, so a test never touches a real install', () => {
    process.env.HERBIE_STATE_DIR = '/tmp/herbie-somewhere'
    process.argv = [...process.argv, '--dev']
    expect(stateDir()).toBe('/tmp/herbie-somewhere')
  })
})

describe('where an agent works', () => {
  test('each one gets its own directory under the install', () => {
    process.env.HERBIE_STATE_DIR = '/tmp/herbie-somewhere'
    expect(agentDir('reader')).toBe('/tmp/herbie-somewhere/agents/reader')
  })
})
