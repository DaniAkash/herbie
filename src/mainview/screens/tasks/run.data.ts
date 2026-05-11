import { useMemo, useRef } from 'react'
import {
  type TaskRunSummary,
  useTaskRun,
  useTaskRunLiveStream,
} from '@/modules/api/task-runs.hooks'
import { emptyChatViewState, reduceChatEvents } from '../chat/chat.helpers'
import type {
  ChatMessage,
  ChatViewState,
  PersistedEventDTO,
} from '../chat/chat.types'

// Detail shape returned by GET /tasks/:id/runs/:runId. Spelled out
// here because ReturnType<typeof useTaskRun>['data'] resolves to {}
// through the react-query-kit + Hono RPC type pipeline (the success
// branch of the union narrows too aggressively).
export interface RunDetail {
  run: TaskRunSummary
  events: PersistedEventDTO[]
}

export interface UseRunDataResult {
  isLoading: boolean
  run: RunDetail | null
  messages: ChatMessage[]
  // True while the run's event log doesn't yet have a terminal event.
  // Same semantic as chat's view-derived isStreaming — the row's
  // `status` field is the source of truth long-term, but the reducer
  // tracks it live during a streaming run.
  isStreaming: boolean
}

// Reduces a task run's persisted event log into ChatMessage[] using
// the same reducer the chat screen uses. Tasks emit identical event
// types (turn.start / assistant.text / reasoning.complete / tool.* /
// turn.finish|cancel|error) so the reducer is a clean fit. The
// renderer then filters parts via the partKinds prop on
// ChatMessageRow ('text' only, per the plan).
export function useRunData(
  taskId: string,
  runId: string | null,
): UseRunDataResult {
  const query = useTaskRun({
    variables: { taskId, runId: runId ?? '' },
    enabled: !!runId,
  })
  useTaskRunLiveStream(runId ? taskId : null, runId)

  // Same incremental-reduce pattern as chat.data — keeps text-delta
  // streams O(events) instead of O(events²).
  const stateRef = useRef<{ runId: string; state: ChatViewState }>({
    runId: runId ?? '',
    state: emptyChatViewState(),
  })

  const view = useMemo(() => {
    const events = (query.data?.events ?? []) as PersistedEventDTO[]
    const prior =
      stateRef.current.runId === runId
        ? stateRef.current.state
        : emptyChatViewState()
    const next = reduceChatEvents(prior, events)
    stateRef.current = { runId: runId ?? '', state: next }
    return next
  }, [runId, query.data?.events])

  return {
    isLoading: query.isLoading,
    run: (query.data as RunDetail | undefined) ?? null,
    messages: view.messages,
    isStreaming: view.isStreaming,
  }
}
