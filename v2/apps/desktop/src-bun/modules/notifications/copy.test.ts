import { describe, expect, test } from 'bun:test'
import { titleFor } from '@bun/modules/notifications/copy'

describe('the title says which agent, and where', () => {
  test('the agent and its workspace, when they differ', () => {
    expect(titleFor('Scout', '/Users/someone/code/herbie')).toBe(
      'Scout · herbie',
    )
  })

  test('a workspace with no basename leaves the name alone', () => {
    expect(titleFor('Scout', '/')).toBe('Scout')
  })
})

describe('the workspace is dropped when it only repeats the name', () => {
  // The live case this was written for. An agent called Ops working in a
  // directory called ops rendered as "Ops · ops", which is the duplicate the
  // dedupe exists to prevent and which an exact comparison let through.
  test('differing only in case', () => {
    expect(titleFor('Ops', '/Users/someone/.herbie/agents/ops')).toBe('Ops')
  })

  test('an exact match', () => {
    expect(titleFor('herbie', '/Users/someone/code/herbie')).toBe('herbie')
  })

  test('differing only in separators', () => {
    expect(titleFor('Night Watch', '/Users/someone/code/night-watch')).toBe(
      'Night Watch',
    )
  })

  test('differing in both', () => {
    expect(titleFor('Inbox_Er', '/Users/someone/code/inbox-er')).toBe(
      'Inbox_Er',
    )
  })
})

describe('a workspace that merely contains the name is still shown', () => {
  test('because it is a different place', () => {
    expect(titleFor('Ops', '/Users/someone/code/ops-tooling')).toBe(
      'Ops · ops-tooling',
    )
  })
})
