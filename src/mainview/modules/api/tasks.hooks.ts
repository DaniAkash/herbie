import type { InferRequestType, InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from './client'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'

const $list = api.tasks.$get
const $create = api.tasks.$post
const $get = api.tasks[':id'].$get
const $patch = api.tasks[':id'].$patch
const $delete = api.tasks[':id'].$delete

export type TasksListResponse = InferResponseType<typeof $list>
export type TaskSummary = TasksListResponse[number]

// Internal — query/mutation generics consume these; exporting them
// has no callers and trips the dead-export check.
type TaskDetail = Exclude<InferResponseType<typeof $get>, { error: string }>
type CreateTaskInput = InferRequestType<typeof $create>['json']
type UpdateTaskInput = InferRequestType<typeof $patch>['json'] & {
  id: string
}

export const useTasks = createQuery<TasksListResponse>({
  queryKey: ['tasks', 'list'],
  fetcher: () => $list().then(parseResponse<TasksListResponse>),
})

export const useTask = createQuery<TaskDetail, { id: string }>({
  queryKey: ['tasks', 'detail'],
  fetcher: ({ id }) => $get({ param: { id } }).then(parseResponse<TaskDetail>),
})

export const useCreateTask = createMutation<TaskDetail, CreateTaskInput>({
  mutationFn: (json) => $create({ json }).then(parseResponse<TaskDetail>),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: useTasks.getKey() })
  },
})

export const useUpdateTask = createMutation<TaskDetail, UpdateTaskInput>({
  mutationFn: ({ id, ...json }) =>
    $patch({ param: { id }, json }).then(parseResponse<TaskDetail>),
  onSuccess: (_data, vars) => {
    queryClient.invalidateQueries({ queryKey: useTasks.getKey() })
    queryClient.invalidateQueries({
      queryKey: useTask.getKey({ id: vars.id }),
    })
  },
})

export const useDeleteTask = createMutation<{ ok: boolean }, { id: string }>({
  mutationFn: ({ id }) =>
    $delete({ param: { id } }).then(parseResponse<{ ok: boolean }>),
  onSuccess: (_data, vars) => {
    queryClient.invalidateQueries({ queryKey: useTasks.getKey() })
    queryClient.removeQueries({ queryKey: useTask.getKey({ id: vars.id }) })
  },
})
