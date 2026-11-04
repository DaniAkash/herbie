import { hold, release, settle } from '@bun/modules/conversation/pending'
import {
  type RecordTarget,
  writeRecord,
} from '@bun/modules/conversation/records'
import type { Db } from '@bun/modules/db/db'
import type { PermissionChoice } from '@bun/shared/transcript'
import type {
  AcpPermissionDecision,
  AcpPermissionRequest,
} from 'acpx-ai-provider'

/**
 * What the agent is allowed to do, and who decides when it is not.
 *
 * v1's flow was right and ports almost unchanged: a callback escalates, the
 * request reaches the renderer, a card collects a decision, an HTTP route
 * resolves the promise, a cancel drains the registry. What changes is what
 * the card can offer and where the request is kept.
 *
 * The decision goes back as the agent's own option id. v1 approximated every
 * agent's option set with four fixed buttons; `request.raw.options` is what
 * this agent actually offered, so the card renders those instead of guessing.
 */

/**
 * Kinds that never interrupt the person.
 *
 * A coding agent reads constantly, so escalating a read would make an agent
 * on `ask` unusable rather than careful. Returning undefined falls through to
 * `permissionMode`, which is `approve-reads` for exactly this.
 */
const QUIET = new Set(['read', 'search', 'fetch', 'think'])

/**
 * Puts a request in front of the person and waits for them.
 *
 * The request is written to the thread rather than held in the reducer, so
 * one still waiting is still visible after a restart. That matters far more
 * for an agent that works while nobody is watching than it did for the chat
 * window v1 was built for.
 */
export function escalate(
  db: Db,
  target: RecordTarget,
  request: AcpPermissionRequest,
  signal: AbortSignal,
): Promise<AcpPermissionDecision | undefined> {
  if (request.inferredKind && QUIET.has(request.inferredKind)) {
    return Promise.resolve(undefined)
  }

  const options: PermissionChoice[] = request.raw.options.map((option) => ({
    optionId: option.optionId,
    name: option.name,
    kind: option.kind,
  }))
  // An agent that offered nothing to choose between cannot be answered by a
  // card. Falling through at least applies the policy rather than hanging.
  if (options.length === 0) return Promise.resolve(undefined)

  const requestId = request.raw.toolCall.toolCallId
  writeRecord(db, target, {
    kind: 'permission',
    requestId,
    toolName: request.raw.toolCall.title ?? 'A tool',
    detail: request.inferredKind ?? '',
    options,
    decision: null,
  })

  return new Promise((resolve) => {
    hold<AcpPermissionDecision>(target.agentId, requestId, {
      resolve,
      onCancel: () => ({ outcome: 'cancel' }),
    })
    // The turn's own signal is the bound on this wait. There is deliberately
    // no timeout: an agent working overnight should still be waiting at
    // breakfast rather than having quietly denied itself at 3am.
    signal.addEventListener(
      'abort',
      () => {
        release(target.agentId, requestId)
        resolve({ outcome: 'cancel' })
      },
      { once: true },
    )
  })
}

/**
 * Records the person's decision and hands it to the waiting agent.
 *
 * False when nothing was waiting on that id, which the route turns into a
 * 409. A decision that resolved nothing is worse than a rejected one: the
 * person believes they answered and the agent is still stopped.
 */
export function decide(
  db: Db,
  target: RecordTarget,
  requestId: string,
  recordId: string,
  optionId: string,
): boolean {
  const settled = settle<AcpPermissionDecision>(target.agentId, requestId, {
    outcome: 'selected',
    optionId,
  })
  if (!settled) return false
  writeRecord(db, target, { kind: 'decision', ref: recordId, optionId })
  return true
}
