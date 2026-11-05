import { describe, expect, test } from 'bun:test'
import { createTurnGate } from './turn-gate'

describe('accepted turn gate', () => {
  test('blocks duplicate sends until the accepted turn ends', () => {
    const gate = createTurnGate()
    expect(gate.begin()).toBe(true)
    expect(gate.begin()).toBe(false)
    expect(gate.accept('a')).toBe(true)
    expect(gate.end('other')).toBe(false)
    expect(gate.begin()).toBe(false)
    expect(gate.end('a')).toBe(true)
    expect(gate.begin()).toBe(true)
  })
  test('handles a terminal event arriving before the POST response', () => {
    const gate = createTurnGate()
    gate.begin()
    expect(gate.end('a')).toBe(false)
    expect(gate.accept('a')).toBe(false)
    expect(gate.begin()).toBe(true)
  })
  test('releases after a failed send', () => {
    const gate = createTurnGate()
    gate.begin()
    gate.fail()
    expect(gate.begin()).toBe(true)
  })
})
