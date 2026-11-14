import { beforeEach, describe, expect, test } from 'bun:test'
import {
  currentPresence,
  PRESENCE_STALE_MS,
  reportPresence,
  resetPresence,
} from '@bun/modules/notifications/presence'

beforeEach(resetPresence)

describe('what is assumed about the person', () => {
  test('nothing reported reads as absent', () => {
    expect(currentPresence(1_000)).toEqual({
      focused: false,
      agentId: null,
      at: 0,
    })
  })

  test('a fresh report is believed', () => {
    reportPresence({ focused: true, agentId: 'scout', at: 1_000 })
    const now = currentPresence(1_000 + PRESENCE_STALE_MS - 1)
    expect(now.focused).toBe(true)
    expect(now.agentId).toBe('scout')
  })

  test('a report exactly at the ceiling is still believed', () => {
    reportPresence({ focused: true, agentId: 'scout', at: 1_000 })
    expect(currentPresence(1_000 + PRESENCE_STALE_MS).focused).toBe(true)
  })

  /**
   * The asymmetry the whole module rests on. A webview that died has to read
   * as not watching, so notifications still fire. Reading it the other way
   * would suppress every notification for an app whose window is gone.
   */
  test('a stale report reads as absent, never as watching', () => {
    reportPresence({ focused: true, agentId: 'scout', at: 1_000 })
    const later = currentPresence(1_000 + PRESENCE_STALE_MS + 1)
    expect(later.focused).toBe(false)
    expect(later.agentId).toBe(null)
  })

  test('a later report replaces an earlier one', () => {
    reportPresence({ focused: true, agentId: 'scout', at: 1_000 })
    reportPresence({ focused: true, agentId: 'house', at: 2_000 })
    expect(currentPresence(2_000).agentId).toBe('house')
  })

  test('blurring is reported like anything else', () => {
    reportPresence({ focused: true, agentId: 'scout', at: 1_000 })
    reportPresence({ focused: false, agentId: 'scout', at: 2_000 })
    expect(currentPresence(2_000).focused).toBe(false)
  })
})
