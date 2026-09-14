import type { Thread } from 'chat'
import { getEventBus } from '../chat/eventBus'
import type { PersistedEvent } from '../chat/events.types'
import {
  buildApprovalCard,
  expireApprovals,
  isPermissionRequest,
} from './approvals'
import {
  isTerminal,
  renderEvent,
  STREAM_BUDGET,
  splitForTelegram,
  terminalNotice,
} from './presenter'

/**
 * Forwards one turn to a Telegram thread.
 *
 * The bus is turned into an async iterable and handed to `thread.post`,
 * which the adapter renders with post-and-edit: one message that grows,
 * rather than one message per event. The adapter owns the edit
 * throttle, which is what keeps this inside Telegram's per-chat rate
 * limit.
 *
 * A streamed post is one message and Telegram caps a message at 4,096
 * characters, so the stream stops at that budget and anything past it
 * is posted as follow-up messages once the stream closes.
 *
 * Resolves when the turn reaches a terminal event.
 */
export async function streamTurnToThread(
  conversationId: string,
  requestId: string,
  thread: Thread,
): Promise<void> {
  const capture = beginTurnCapture(conversationId, thread)
  await capture.bind(requestId)
}

export interface TurnCapture {
  /** Attaches the capture to a turn and resolves when that turn ends. */
  bind: (requestId: string) => Promise<void>
  /** Drops the capture for a turn that never started. */
  abandon: () => void
}

/**
 * Starts listening before the turn does.
 *
 * Subscribing after `appendUserMessage` loses whatever a fast provider
 * emits in between, and since nothing replays those events the stream
 * would then wait for a terminal event that already happened, or a
 * permission card would never be offered. Events are buffered from
 * this moment and filtered once the turn's id is known.
 */
export function beginTurnCapture(
  conversationId: string,
  thread: Thread,
): TurnCapture {
  const turn = collectTurn(conversationId, thread)
  return {
    abandon: () => turn.dispose(),
    bind: async (requestId: string) => {
      turn.bind(requestId)
      try {
        await thread.post(turn.stream())
        for (const chunk of turn.remainder()) {
          await thread.post(chunk)
        }
      } catch {
        // The turn has already run and its events are durable, so a
        // delivery failure must not strand the caller.
      } finally {
        turn.dispose()
        // Only this turn's cards. Expiring by conversation would cancel
        // a request another turn is still waiting on.
        await turn.expireOwnApprovals()
      }
    },
  }
}

interface CollectedTurn {
  bind: (requestId: string) => void
  /** Closes out only the approvals this turn offered. */
  expireOwnApprovals: () => Promise<void>
  stream: () => AsyncIterable<string>
  /** Text that did not fit the streamed message, as postable chunks. */
  remainder: () => string[]
  dispose: () => void
}

// Bridges the push-based event bus to the pull-based async iterable
// `thread.post` consumes, buffering whatever arrives between pulls so a
// fast agent cannot outrun the adapter's edit throttle and lose text.
function collectTurn(conversationId: string, thread: Thread): CollectedTurn {
  const pending: string[] = []
  const tail: string[] = []
  let streamed = 0
  let budgetSpent = false
  let finished = false
  let wake: (() => void) | null = null
  let boundRequestId: string | null = null
  // Events seen before the turn's id was known. Kept raw so they can be
  // filtered once it is.
  const early: PersistedEvent[] = []
  const ownApprovals: string[] = []

  function add(text: string): void {
    // Once the first message is full every further delta belongs to a
    // follow-up message, because a streamed post is a single message
    // and the adapter would otherwise truncate it.
    if (budgetSpent || streamed + text.length > STREAM_BUDGET) {
      budgetSpent = true
      tail.push(text)
      return
    }
    streamed += text.length
    pending.push(text)
    wake?.()
    wake = null
  }

  function offerApproval(
    payload: Parameters<typeof buildApprovalCard>[1],
  ): void {
    void buildApprovalCard(conversationId, payload)
      .then(({ card, approvalId }) => {
        ownApprovals.push(approvalId)
        return thread.post(card)
      })
      .catch(() => {
        // A card that cannot be delivered leaves the turn waiting on
        // the desktop, which is the pre-existing behaviour.
      })
  }

  function accept(event: PersistedEvent): void {
    if (finished) return
    if (boundRequestId === null) {
      early.push(event)
      return
    }
    if (!belongsToTurn(event, boundRequestId)) return

    if (isTerminal(event)) {
      closeOut(event)
      return
    }

    // Permission cards are posted as they arrive rather than folded
    // into the stream: they are interactive, and a card buried inside a
    // growing message would be edited away by the next delta.
    if (isPermissionRequest(event.type, event.payload)) {
      offerApproval(event.payload)
      return
    }

    const text = renderEvent(event)
    if (text) add(text)
  }

  function closeOut(event: PersistedEvent): void {
    const notice = terminalNotice(event)
    if (notice) add(notice)
    finished = true
    unsubscribe()
    wake?.()
    wake = null
  }

  const unsubscribe = getEventBus().subscribe(conversationId, accept)

  return {
    bind(requestId: string): void {
      boundRequestId = requestId
      const buffered = early.splice(0, early.length)
      for (const event of buffered) accept(event)
    },
    async *stream(): AsyncIterable<string> {
      while (true) {
        const next = pending.shift()
        if (next !== undefined) {
          yield next
          continue
        }
        if (finished) return
        await new Promise<void>((resolve) => {
          wake = resolve
        })
      }
    },
    expireOwnApprovals: () => expireApprovals(ownApprovals),
    remainder: () => (tail.length === 0 ? [] : splitForTelegram(tail.join(''))),
    dispose: () => {
      if (finished) return
      finished = true
      unsubscribe()
    },
  }
}

// Durable tool events are written straight from the provider's stream
// part, which carries the tool's own ids but no turn id. The
// subscription is per-turn and torn down at its terminal event, so an
// unstamped event can only have come from the turn being captured.
function belongsToTurn(event: PersistedEvent, requestId: string): boolean {
  const payload = event.payload as { requestId?: string } | null
  if (payload?.requestId === undefined) return event.type.startsWith('tool.')
  return payload.requestId === requestId
}
