import { useEffect, useReducer, useRef, useState } from 'react'
import {
  useAnswer,
  useCancelTurn,
  useDecide,
  useSendTurn,
} from '@/modules/api/conversation.hooks'
import { openStream } from '@/modules/api/stream'
import {
  EMPTY,
  type ThreadState,
  threadReducer,
} from '@/screens/conversation/conversation.reducer'

/**
 * Everything the conversation screen needs, as one hook.
 *
 * There is no second request for the history. The stream replays the thread
 * from the agent's folder before it goes live, so one connection delivers
 * both and a record looks the same whichever side of that line it arrived
 * on. A query alongside it would be a second order for the same thread.
 */

/** Whether the thread is reachable, which is the only loading state there is. */
export type Connection = 'connecting' | 'open' | 'lost'

export interface ConversationData {
  readonly thread: ThreadState
  readonly connection: Connection
  /** True while a turn is being started or stopped, for the composer. */
  readonly isSending: boolean
  readonly send: (text: string) => void
  readonly stop: () => void
  readonly answer: (recordId: string, answers: Record<string, number[]>) => void
  readonly decide: (
    recordId: string,
    requestId: string,
    optionId: string,
  ) => void
}

/** Long enough not to hammer a sidecar that is restarting. */
const RECONNECT_MS = 1500

export function useConversation(agentId: string): ConversationData {
  const [thread, dispatch] = useReducer(threadReducer, EMPTY)
  const [connection, setConnection] = useState<Connection>('connecting')
  const send = useSendTurn()
  const cancel = useCancelTurn()
  const answer = useAnswer()
  const decide = useDecide()

  // Read by the reconnect, which must not re-run the effect when it moves.
  // Reconnecting from the cursor is what stops a dropped connection replaying
  // a long thread from the start every time.
  const cursor = useRef(-1)
  cursor.current = thread.lastSeq

  // An SSE connection is an external system with a lifetime of its own, which
  // is the case an effect exists for. Keyed on the agent, so switching agents
  // closes the old stream rather than leaving two open.
  useEffect(() => {
    dispatch({ type: 'reset' })
    cursor.current = -1
    setConnection('connecting')

    let closed = false
    let close = () => {}
    let retry: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      close = openStream(
        `/api/agents/${agentId}/stream?after=${cursor.current}`,
        {
          onEvent: (event, data) => {
            setConnection('open')
            if (event === 'record') {
              dispatch({ type: 'record', record: JSON.parse(data) })
              return
            }
            if (event === 'turn') {
              dispatch({ type: 'turn', live: JSON.parse(data) })
            }
          },
          onClose: (aborted) => {
            if (aborted || closed) return
            setConnection('lost')
            retry = setTimeout(connect, RECONNECT_MS)
          },
        },
      )
    }
    connect()

    return () => {
      closed = true
      clearTimeout(retry)
      close()
    }
  }, [agentId])

  return {
    thread,
    connection,
    isSending: send.isPending || cancel.isPending,
    send: (text) => send.mutate({ agentId, text }),
    stop: () => cancel.mutate({ agentId }),
    answer: (recordId, answers) =>
      answer.mutate({ agentId, recordId, answers }),
    decide: (recordId, requestId, optionId) =>
      decide.mutate({ agentId, requestId, recordId, optionId }),
  }
}
