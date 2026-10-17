import { describe, expect, test } from 'bun:test'
import { isPermissionRequest } from './approvals'

function request(over: Record<string, unknown> = {}) {
  return {
    requestId: 'req-1',
    turnRequestId: 'turn-1',
    toolCallId: 'call-1',
    toolName: 'edit',
    toolKind: 'edit',
    input: { path: 'README.md' },
    ...over,
  }
}

describe('isPermissionRequest', () => {
  test('accepts a real permission request', () => {
    expect(isPermissionRequest('permission.request', request())).toBe(true)
  })

  test('rejects other event types carrying a similar payload', () => {
    expect(isPermissionRequest('permission.resolved', request())).toBe(false)
  })

  // The forwarder pairs a card with the turn that raised it, so a
  // payload missing that link must not be treated as forwardable.
  test('rejects a payload without the turn it belongs to', () => {
    const { turnRequestId: _omitted, ...rest } = request()
    expect(isPermissionRequest('permission.request', rest)).toBe(false)
  })

  test('rejects non-object payloads', () => {
    expect(isPermissionRequest('permission.request', null)).toBe(false)
    expect(isPermissionRequest('permission.request', 'edit')).toBe(false)
  })
})
