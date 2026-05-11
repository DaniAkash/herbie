import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { PageHeader } from '@/components/layout/PageHeader'
import { LinkButton } from '@/components/ui/link-button'
import { useDefaultAgent } from '@/modules/api/settings.hooks'
import {
  useCreateTask,
  useDeleteTask,
  useTask,
  useUpdateTask,
} from '@/modules/api/tasks.hooks'
import type { AgentId, ScheduleConfig } from '@/modules/data/herbie-data.types'
import { DeleteTaskDialog } from './DeleteTaskDialog'
import {
  EditorFooter,
  EditorSidebar,
  EditorSkeleton,
  TaskFormFields,
} from './task-editor.components'
import { type TaskFormValues, taskFormSchema } from './task-editor.schemas'

export type EditorProps = {
  mode: 'create' | 'edit'
  taskId?: string
  initialPrompt?: string
  initialAgent?: AgentId
  initialWorkspaceId?: string
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
  kind: 'daily',
  hour: 9,
  minute: 0,
}

export function TaskEditor(props: EditorProps) {
  if (props.mode === 'edit' && props.taskId) {
    return <EditExisting {...props} taskId={props.taskId} />
  }
  return <CreateNew {...props} />
}

function CreateNew({ initialPrompt, initialAgent }: EditorProps) {
  const { defaultAgent } = useDefaultAgent()
  return (
    <EditorBody
      mode="create"
      defaultValues={{
        name: '',
        prompt: initialPrompt ?? '',
        agentId: initialAgent ?? defaultAgent,
        modelId: null,
        workspacePath: null,
        reasoningEffort: null,
        schedule: DEFAULT_SCHEDULE,
      }}
      initialName=""
      initialStatus="active"
    />
  )
}

function EditExisting({ taskId }: EditorProps & { taskId: string }) {
  const { data, isLoading } = useTask({ variables: { id: taskId } })
  if (isLoading) return <EditorSkeleton />
  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Task not found.</p>
      </div>
    )
  }
  return (
    <EditorBody
      mode="edit"
      taskId={taskId}
      currentStatus={data.status}
      initialName={data.name}
      initialStatus={data.status}
      defaultValues={{
        name: data.name,
        prompt: data.prompt,
        agentId: data.agentId as AgentId,
        modelId: data.modelId,
        workspacePath: data.workspacePath,
        reasoningEffort: data.reasoningEffort,
        schedule: data.schedule,
      }}
    />
  )
}

function EditorBody({
  mode,
  taskId,
  defaultValues,
  initialName,
  initialStatus,
  currentStatus,
}: {
  mode: 'create' | 'edit'
  taskId?: string
  defaultValues: TaskFormValues
  // Snapshot for the page header — kept stable so renaming a task
  // doesn't retitle mid-edit. The form holds the live name.
  initialName: string
  // Captured at mount; used as the fallback when `currentStatus`
  // hasn't been threaded through (i.e. create mode).
  initialStatus: 'active' | 'paused'
  // Latest status from the task query. Drives the Pause/Resume label
  // and toggle value so they reflect the latest mutation instead of
  // the value captured at mount.
  currentStatus?: 'active' | 'paused'
}) {
  const navigate = useNavigate()
  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()
  const deleteMutation = useDeleteTask()

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues,
    // `onChange` (not `onTouched`) on purpose. The schedule field
    // is a discriminated union whose inputs live inside ScheduleField
    // and never call `field.onBlur` on the parent `schedule` Controller,
    // so `onTouched` would suppress the cron-refine error until the
    // user hit Submit. `onChange` validates on every keystroke; the
    // form is small enough that the cost is irrelevant.
    mode: 'onChange',
  })

  const [confirmDelete, setConfirmDelete] = useState(false)
  const isExisting = mode === 'edit' && taskId != null
  const isBusy = createMutation.isPending || updateMutation.isPending

  const onSubmit = form.handleSubmit(async (values) => {
    if (taskId) {
      await updateMutation.mutateAsync({ id: taskId, ...values })
    } else {
      await createMutation.mutateAsync(values)
    }
    navigate({ to: '/tasks' })
  })

  async function handleDeleteConfirmed() {
    if (!taskId) return
    await deleteMutation.mutateAsync({ id: taskId })
    navigate({ to: '/tasks' })
  }

  async function togglePause() {
    if (!taskId) return
    const status = currentStatus ?? initialStatus
    await updateMutation.mutateAsync({
      id: taskId,
      status: status === 'active' ? 'paused' : 'active',
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader maxWidth="max-w-2xl">
        <LinkButton to="/tasks" variant="ghost" size="sm">
          <ArrowLeftIcon data-icon="inline-start" />
          Tasks
        </LinkButton>
        <h1 className="font-semibold text-base tracking-tight">
          {mode === 'create' ? 'New scheduled task' : initialName}
        </h1>
      </PageHeader>
      <div className="flex flex-1 overflow-hidden">
        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col overflow-hidden"
          noValidate
        >
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-6 py-8">
              <TaskFormFields form={form} />
            </div>
          </div>
          <EditorFooter
            mode={mode}
            isExisting={isExisting}
            isBusy={isBusy}
            status={currentStatus ?? initialStatus}
            onTogglePause={togglePause}
            onRequestDelete={() => setConfirmDelete(true)}
          />
        </form>
        <EditorSidebar
          form={form}
          taskId={taskId ?? null}
          onCreateAndNavigate={async () => {
            const values = form.getValues()
            const created = await createMutation.mutateAsync(values)
            navigate({
              to: '/tasks/$id',
              params: { id: created.id },
              replace: true,
            })
            return created.id
          }}
        />
      </div>
      {isExisting && (
        <DeleteTaskDialog
          open={confirmDelete}
          taskName={initialName}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDeleteConfirmed}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
