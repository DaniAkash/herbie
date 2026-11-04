import { describe, expect, test } from 'bun:test'
import { readProbe } from '@bun/modules/runtimes/probe'
import type { AgentProbeResult } from 'acp-probe'

function result(over: Partial<AgentProbeResult>): AgentProbeResult {
  return {
    agent: {
      id: null,
      command: 'x',
      argv: [],
      probedAt: '2026-11-03T00:00:00.000Z',
      durationMs: 1,
    },
    protocolVersion: 1,
    agentInfo: null,
    capabilities: {
      loadSession: false,
      promptCapabilities: {
        image: false,
        audio: false,
        embeddedContext: false,
      },
      mcpCapabilities: { http: false, sse: false },
      sessionCapabilities: {
        close: false,
        list: false,
        resume: false,
        fork: false,
        additionalDirectories: false,
      },
    },
    authMethods: [],
    models: [],
    modes: [],
    configOptions: [],
    reasoning: null,
    modelConfig: null,
    supportsConfigOption: false,
    raw: { initialize: {}, newSession: {} },
    ...over,
  } as AgentProbeResult
}

describe('reading a probe', () => {
  test('a runtime with no settable picker reports no model values', () => {
    const read = readProbe(
      result({
        models: [{ id: 'gpt-5.2/high' }, { id: 'gpt-5.2/low' }],
        modelConfig: null,
      }),
    )
    // The advertised ids are kept for display, but nothing may be set, so the
    // picker has nothing to offer and the row is dropped rather than drawn.
    expect(read.models).toEqual(['gpt-5.2/high', 'gpt-5.2/low'])
    expect(read.modelValues).toEqual([])
  })

  test('the settable list is taken from modelConfig, never from models', () => {
    const read = readProbe(
      result({
        models: [{ id: 'gpt-5.2/high' }],
        modelConfig: { configId: 'model', values: ['gpt-5.2'] },
        supportsConfigOption: true,
      }),
    )
    expect(read.modelValues).toEqual(['gpt-5.2'])
    expect(read.modelValues).not.toContain('gpt-5.2/high')
  })

  test('thought levels become the effort row', () => {
    const read = readProbe(
      result({
        reasoning: { configId: 'effort', values: ['low', 'medium', 'high'] },
      }),
    )
    expect(read.efforts).toEqual(['low', 'medium', 'high'])
  })

  test('only an auth failure counts as not signed in', () => {
    expect(readProbe(result({})).signedIn).toBe(true)
    expect(
      readProbe(
        result({ error: { code: 'auth_required', message: 'sign in first' } }),
      ).signedIn,
    ).toBe(false)
    expect(
      readProbe(
        result({ error: { code: 'spawn_failed', message: 'no such command' } }),
      ).signedIn,
    ).toBe(true)
  })
})
