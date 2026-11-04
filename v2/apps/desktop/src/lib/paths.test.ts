import { describe, expect, test } from 'bun:test'
import { shortenHome } from '@/lib/paths'

describe('showing a path', () => {
  test('the home directory reads as a tilde', () => {
    expect(shortenHome('/Users/someone/.herbie/agents/reader')).toBe(
      '~/.herbie/agents/reader',
    )
    expect(shortenHome('/home/someone/.herbie/agents/reader')).toBe(
      '~/.herbie/agents/reader',
    )
  })

  test('a path somewhere else is left alone', () => {
    expect(shortenHome('/opt/work/repo')).toBe('/opt/work/repo')
    expect(shortenHome('/Volumes/ext/code')).toBe('/Volumes/ext/code')
  })

  test('only the leading home is replaced', () => {
    expect(shortenHome('/Users/a/src/Users/b/x')).toBe('~/src/Users/b/x')
  })
})
