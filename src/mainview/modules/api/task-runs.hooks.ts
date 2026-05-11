import type { InferRequestType, InferResponseType } from 'hono/client'
import { useEffect, useRef } from 'react'
import { createMutation, createQuery } from 'react-query-kit'
import { openTaskRunStream } from '@/modules/tasks/task-run-stream'
import { api } from './client'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'
import { useTask, useTasks } from './tasks.hooks'

const $list = api.tasks[':id'].runs.$get
const $detail = api.tasks[':id'].runs[':runId'].$get
const $test = api.tasks[':id'].test.$post
const $cancel = api.tasks[':id'].runs[':runId'].cancel.$post

export type TaskRunsListResponse = InferResponseType<typeof $list>
export type TaskRunSummary = TaskRunsListResponse[number]
type TaskRunDetail = Exclude<
  InferResponseType<typeof $detail>,
  { error: string }
>
type TestRunInput = { id: string } & InferRequestType<typeof $test>['json']

export const useTaskRuns = createQuery<TaskRunsListResponse, { id: string }>({
  queryKey: ['tasks', 'runs', 'list'],
  fetcher: ({ id }) =>
    $list({ param: { id } }).then(parseResponse<TaskRunsListResponse>),
})

export const useTaskRun = createQuery<
  TaskRunDetail,
  { taskId: string; runId: string }
>({
  queryKey: ['tasks', 'runs', 'detail'],
  fetcher: ({ taskId, runId }) =>
    $detail({ param: { id: taskId, runId } }).then(
      parseResponse<TaskRunDetail>,
    ),
})

// Test invokes a one-shot run with the editor's current draft. SSE
// drives the live view; the mutation just kicks the run off.
export const useTestTaskRun = createMutation<{ runId: string }, TestRunInput>({
  mutationFn: ({ id, ...body }) =>
    $test({ param: { id }, json: body }).then(parseResponse<{ runId: string }>),
  onSuccess: (_data, vars) => {
    queryClient.invalidateQueries({
      queryKey: useTaskRuns.getKey({ id: vars.id }),
    })
  },
})

export const useCancelTaskRun = createMutation<
  { ok: boolean },
  { taskId: string; runId: string }
>({
  mutationFn: ({ taskId, runId }) =>
    $cancel({ param: { id: taskId, runId } }).then(
      parseResponse<{ ok: boolean }>,
    ),
})

// SSE subscriber for a single run. Mirrors useChatLiveStream's shape;
// applies inbound events to the run-detail cache so the renderer's
// reducer sees a growing events array. The list query is invalidated
// on terminal events so the sidebar's row status / duration refresh.
export function useTaskRunLiveStream(
  taskId: string | null,
  runId: string | null,
): void {
  const lastSeqRef = useRef(-1)

  useEffect(() => {
    if (!taskId || !runId) return
    lastSeqRef.current = -1

    const handle = openTaskRunStream(taskId, runId, {
      afterSeq: -1,
      onEvent: (ev) => {
        if (ev.seq <= lastSeqRef.current) return
        const appended = appendRunEvent(taskId, runId, ev)
        if (!appended) return
        lastSeqRef.current = ev.seq
        if (ev.type.startsWith('turn.')) {
          queryClient.invalidateQueries({
            queryKey: useTaskRuns.getKey({ id: taskId }),
          })
          // Task's lastRunAt / nextRunAt updates land via the same
          // invalidation path, so refresh the task detail too.
          queryClient.invalidateQueries({
            queryKey: useTask.getKey({ id: taskId }),
          })
          queryClient.invalidateQueries({ queryKey: useTasks.getKey() })
        }
      },
    })

    return () => handle.close()
  }, [taskId, runId])
}

function appendRunEvent(
  taskId: string,
  runId: string,
  ev: { seq: number; type: string; payload: unknown; createdAt: number },
): boolean {
  const key = useTaskRun.getKey({ taskId, runId })
  const cached = queryClient.getQueryData<TaskRunDetail>(key)
  if (!cached) {
    void queryClient.invalidateQueries({ queryKey: key })
    return false
  }
  if (cached.events.some((e: { seq: number }) => e.seq === ev.seq)) return true

  const last = cached.events[cached.events.length - 1]
  const events =
    !last || ev.seq > last.seq
      ? [...cached.events, ev]
      : [...cached.events, ev].sort(
          (a: { seq: number }, b: { seq: number }) => a.seq - b.seq,
        )
  queryClient.setQueryData<TaskRunDetail>(key, { ...cached, events })
  return true
}
