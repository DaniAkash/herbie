import { describe, expect, test } from 'bun:test'
import {
  advance,
  allows,
  BACKOFF_CAP_MS,
  BREAKER_COOLDOWN_MS,
  type BreakerState,
  backoffFor,
  CLOSED,
  onCancelled,
  onFailure,
  onSuccess,
  reset,
} from '@bun/modules/loop/breaker'

const AT = 1_000_000
/** No jitter, so the assertions are about the state machine not the dice. */
const steady = () => 0

function failTimes(times: number, at = AT): BreakerState {
  let state = CLOSED
  for (let n = 0; n < times; n += 1) state = onFailure(state, at, steady)
  return state
}

describe('the breaker', () => {
  test('lets work through while it is closed', () => {
    expect(allows(CLOSED, AT)).toBe(true)
  })

  test('opens on the third consecutive failure, not the first', () => {
    expect(failTimes(1).phase).toBe('closed')
    expect(failTimes(2).phase).toBe('closed')
    expect(failTimes(3).phase).toBe('open')
  })

  test('a success in between clears the streak', () => {
    let state = failTimes(2)
    state = onSuccess(state)
    expect(state.streak).toBe(0)
    expect(onFailure(state, AT, steady).phase).toBe('closed')
  })

  test('refuses work while open, and offers a probe after the cooldown', () => {
    const open = failTimes(3)
    expect(allows(open, AT + 1000)).toBe(false)
    expect(allows(open, AT + BREAKER_COOLDOWN_MS)).toBe(true)
    expect(advance(open, AT + BREAKER_COOLDOWN_MS).phase).toBe('half-open')
  })

  test('a probe that works closes it', () => {
    const probing = advance(failTimes(3), AT + BREAKER_COOLDOWN_MS)
    expect(onSuccess(probing).phase).toBe('closed')
  })

  test('a probe that fails reopens at once rather than needing three more', () => {
    const probing = advance(failTimes(3), AT + BREAKER_COOLDOWN_MS)
    const after = onFailure(probing, AT + BREAKER_COOLDOWN_MS, steady)
    expect(after.phase).toBe('open')
    expect(after.trips).toBe(2)
  })

  test('parks after three trips and stays parked', () => {
    let state = failTimes(3)
    expect(state.trips).toBe(1)

    for (let trip = 0; trip < 2; trip += 1) {
      state = advance(state, (state.openedAt ?? AT) + BREAKER_COOLDOWN_MS)
      state = onFailure(
        state,
        (state.openedAt ?? AT) + BREAKER_COOLDOWN_MS,
        steady,
      )
    }

    expect(state.phase).toBe('parked')
    expect(allows(state, AT + 10 * BREAKER_COOLDOWN_MS)).toBe(false)
    // A parked agent does not quietly recover on its own.
    expect(onSuccess(state).phase).toBe('parked')
    expect(reset().phase).toBe('closed')
  })

  test('a cancelled turn is not the agent failing', () => {
    const one = failTimes(1)
    const after = onCancelled(one)
    // Three routines the person stopped by hand must not park their agent.
    expect(after.streak).toBe(one.streak)
    expect(after.retryAt).toBeNull()
  })

  test('holds work back until the backoff has elapsed', () => {
    const jittered = onFailure(CLOSED, AT, () => 0.5)
    expect(jittered.retryAt).toBeGreaterThan(AT)
    expect(allows(jittered, AT + 1)).toBe(false)
    expect(allows(jittered, (jittered.retryAt ?? AT) + 1)).toBe(true)
  })
})

describe('the backoff', () => {
  test('is bounded by the cap however long the streak runs', () => {
    for (const attempt of [1, 5, 20, 100]) {
      expect(backoffFor(attempt, () => 0.999)).toBeLessThanOrEqual(
        BACKOFF_CAP_MS,
      )
    }
  })

  test('is jittered, so shared failures do not retry in lockstep', () => {
    // Full jitter means the whole range is reachable, which is the property
    // that desynchronises several agents failing on one cause.
    expect(backoffFor(8, () => 0)).toBe(0)
    expect(backoffFor(8, () => 0.999)).toBeGreaterThan(0)
  })
})
