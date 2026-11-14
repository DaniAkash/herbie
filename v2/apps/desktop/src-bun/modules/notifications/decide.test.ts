import { describe, expect, test } from 'bun:test'
import {
  decide,
  recordsAnyway,
  type SuppressReason,
} from '@bun/modules/notifications/decide'
import type {
  AttentionState,
  NotifyEvent,
  NotifyPrefs,
  Presence,
} from '@bun/modules/notifications/events'

const ALL_ON: NotifyPrefs = {
  enabled: true,
  needsYou: true,
  turnFailed: true,
  agentParked: true,
  turnDone: true,
  routineDone: true,
  doneAfterSeconds: 45,
}

const AWAY: Presence = { focused: false, agentId: null, at: 0 }
const ON_SCOUT: Presence = { focused: true, agentId: 'scout', at: 0 }
const ON_HOUSE: Presence = { focused: true, agentId: 'house', at: 0 }

const blocked: NotifyEvent = {
  agentId: 'scout',
  turnId: 't1',
  becomes: 'awaiting',
  text: null,
  kind: 'needs_you',
  reason: 'permission',
}
const asked: NotifyEvent = { ...blocked, reason: 'question' }
const failed: NotifyEvent = {
  agentId: 'scout',
  turnId: 't1',
  becomes: 'failed',
  text: null,
  kind: 'turn_failed',
}
const parked: NotifyEvent = {
  agentId: 'scout',
  turnId: null,
  becomes: 'failed',
  text: null,
  kind: 'agent_parked',
}
const finished = (ranForMs: number): NotifyEvent => ({
  agentId: 'scout',
  turnId: 't1',
  becomes: 'done',
  text: null,
  kind: 'turn_done',
  ranForMs,
})
const routine: NotifyEvent = {
  agentId: 'scout',
  turnId: 't1',
  becomes: 'done',
  text: null,
  kind: 'routine_done',
  routineId: 'r1',
}

interface Row {
  readonly name: string
  readonly event: NotifyEvent
  readonly presence: Presence
  readonly previous: AttentionState
  readonly prefs?: NotifyPrefs
  readonly fires: boolean
  readonly because?: SuppressReason
}

const TABLE: readonly Row[] = [
  {
    name: 'blocked on a permission prompt while away',
    event: blocked,
    presence: AWAY,
    previous: 'working',
    fires: true,
  },
  {
    name: 'blocked on a question while away',
    event: asked,
    presence: AWAY,
    previous: 'working',
    fires: true,
  },
  {
    name: 'blocked while looking at another agent',
    event: blocked,
    presence: ON_HOUSE,
    previous: 'working',
    fires: true,
  },
  {
    name: 'blocked while looking at that very agent',
    event: blocked,
    presence: ON_SCOUT,
    previous: 'working',
    fires: false,
    because: 'already_seen',
  },
  {
    name: 'blocked while that agent is on screen but the window is not focused',
    event: blocked,
    presence: { focused: false, agentId: 'scout', at: 0 },
    previous: 'working',
    fires: true,
  },
  {
    name: 'already awaiting, so not a transition',
    event: blocked,
    presence: AWAY,
    previous: 'awaiting',
    fires: false,
    because: 'not_a_transition',
  },
  {
    name: 'a turn that errored',
    event: failed,
    presence: AWAY,
    previous: 'working',
    fires: true,
  },
  {
    name: 'an agent the breaker parked',
    event: parked,
    presence: AWAY,
    previous: 'working',
    fires: true,
  },
  {
    name: 'a long turn finishing while away',
    event: finished(5 * 60_000),
    presence: AWAY,
    previous: 'working',
    fires: true,
  },
  {
    name: 'a short turn finishing is not news',
    event: finished(6_000),
    presence: AWAY,
    previous: 'working',
    fires: false,
    because: 'too_short_to_miss',
  },
  {
    name: 'exactly at the floor still fires',
    event: finished(45_000),
    presence: AWAY,
    previous: 'working',
    fires: true,
  },
  {
    name: 'a long turn finishing while watching it',
    event: finished(5 * 60_000),
    presence: ON_SCOUT,
    previous: 'working',
    fires: false,
    because: 'already_seen',
  },
  {
    name: 'routine completion is reserved and defaults off',
    event: routine,
    presence: AWAY,
    previous: 'working',
    prefs: { ...ALL_ON, routineDone: false },
    fires: false,
    because: 'kind_disabled',
  },
  {
    name: 'needs_you switched off',
    event: blocked,
    presence: AWAY,
    previous: 'working',
    prefs: { ...ALL_ON, needsYou: false },
    fires: false,
    because: 'kind_disabled',
  },
  {
    name: 'turn completion switched off',
    event: finished(5 * 60_000),
    presence: AWAY,
    previous: 'working',
    prefs: { ...ALL_ON, turnDone: false },
    fires: false,
    because: 'kind_disabled',
  },
  {
    name: 'failures switched off',
    event: failed,
    presence: AWAY,
    previous: 'working',
    prefs: { ...ALL_ON, turnFailed: false },
    fires: false,
    because: 'kind_disabled',
  },
  {
    name: 'parking switched off',
    event: parked,
    presence: AWAY,
    previous: 'working',
    prefs: { ...ALL_ON, agentParked: false },
    fires: false,
    because: 'kind_disabled',
  },
  {
    name: 'the whole feature switched off beats every kind',
    event: blocked,
    presence: AWAY,
    previous: 'working',
    prefs: { ...ALL_ON, enabled: false },
    fires: false,
    because: 'all_disabled',
  },
  {
    name: 'a non transition beats the feature being switched off',
    event: blocked,
    presence: AWAY,
    previous: 'awaiting',
    prefs: { ...ALL_ON, enabled: false },
    fires: false,
    because: 'not_a_transition',
  },
]

describe('the fire matrix', () => {
  for (const row of TABLE) {
    test(row.name, () => {
      const decision = decide(
        row.event,
        row.presence,
        row.previous,
        row.prefs ?? ALL_ON,
      )
      expect(decision.fire).toBe(row.fires)
      if (!decision.fire && row.because) {
        expect(decision.because).toBe(row.because)
      }
    })
  }
})

describe('what a firing decision carries', () => {
  test('collapses on the agent, so one agent holds one live notification', () => {
    const decision = decide(blocked, AWAY, 'working', ALL_ON)
    expect(decision.fire).toBe(true)
    if (!decision.fire) return
    expect(decision.collapseKey).toBe('scout')
    expect(decision.channels).toEqual(['inbox', 'desktop'])
  })

  test('two agents blocked at once do not share a collapse key', () => {
    const house = { ...blocked, agentId: 'house' }
    const a = decide(blocked, AWAY, 'working', ALL_ON)
    const b = decide(house, AWAY, 'working', ALL_ON)
    expect(a.fire && b.fire && a.collapseKey !== b.collapseKey).toBe(true)
  })
})

describe('which suppressions still leave a row behind', () => {
  test('the person could see it, or it was too short to miss', () => {
    expect(recordsAnyway('already_seen')).toBe(true)
    expect(recordsAnyway('too_short_to_miss')).toBe(true)
  })

  test('never news, no longer true, or switched off', () => {
    expect(recordsAnyway('not_a_transition')).toBe(false)
    expect(recordsAnyway('no_longer_true')).toBe(false)
    expect(recordsAnyway('kind_disabled')).toBe(false)
    expect(recordsAnyway('all_disabled')).toBe(false)
  })
})

describe('purity', () => {
  test('the same arguments decide the same way whenever they are asked', () => {
    const first = decide(blocked, AWAY, 'working', ALL_ON)
    const second = decide(blocked, AWAY, 'working', ALL_ON)
    expect(second).toEqual(first)
  })

  test('presence timestamps are not read, only the two fields that matter', () => {
    const stale = decide(blocked, { ...ON_SCOUT, at: 0 }, 'working', ALL_ON)
    const fresh = decide(
      blocked,
      { ...ON_SCOUT, at: Date.now() },
      'working',
      ALL_ON,
    )
    expect(fresh).toEqual(stale)
  })
})
