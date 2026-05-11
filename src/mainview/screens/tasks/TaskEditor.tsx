import { useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, PauseIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { AgentPicker } from '@/components/chat/AgentPicker'
import type { ComposerTuple } from '@/components/chat/composer.types'
import { ModelPicker } from '@/components/chat/ModelPicker'
import { ReasoningPicker } from '@/components/chat/ReasoningPicker'
import { WorkspacePicker } from '@/components/chat/WorkspacePicker'
import { PageFooter, PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LinkButton } from '@/components/ui/link-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useDefaultAgent } from '@/modules/api/settings.hooks'
import {
  useCreateTask,
  useDeleteTask,
  useTask,
  useUpdateTask,
} from '@/modules/api/tasks.hooks'
import type { AgentId, ScheduleConfig } from '@/modules/data/herbie-data.types'
import { DeleteTaskDialog } from './DeleteTaskDialog'
import { OutputsField } from './OutputsField'
import { ScheduleField } from './ScheduleField'
import { TaskRunSidebar } from './TaskRunSidebar'

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
      initial={{
        name: '',
        prompt: initialPrompt ?? '',
        tuple: {
          agentId: initialAgent ?? defaultAgent,
          modelId: null,
          workspacePath: null,
          reasoningEffort: null,
        },
        schedule: DEFAULT_SCHEDULE,
        status: 'active',
      }}
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
      initial={{
        name: data.name,
        prompt: data.prompt,
        tuple: {
          agentId: data.agentId as AgentId,
          modelId: data.modelId,
          workspacePath: data.workspacePath,
          reasoningEffort: data.reasoningEffort,
        },
        schedule: data.schedule,
        status: data.status,
      }}
    />
  )
}

interface EditorState {
  name: string
  prompt: string
  tuple: ComposerTuple
  schedule: ScheduleConfig
  status: 'active' | 'paused'
}

function EditorBody({
  mode,
  taskId,
  initial,
  currentStatus,
}: {
  mode: 'create' | 'edit'
  taskId?: string
  initial: EditorState
  // Latest status from the query — `initial.status` is captured at
  // mount and doesn't reflect pause/resume mutations. Drives both the
  // button label and the value sent on toggle.
  currentStatus?: 'active' | 'paused'
}) {
  const navigate = useNavigate()
  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()
  const deleteMutation = useDeleteTask()

  const [name, setName] = useState(initial.name)
  const [prompt, setPrompt] = useState(initial.prompt)
  const [tuple, setTuple] = useState<ComposerTuple>(initial.tuple)
  const [schedule, setSchedule] = useState<ScheduleConfig>(initial.schedule)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const canSave = name.trim().length > 0 && prompt.trim().length > 0
  const isExisting = mode === 'edit' && taskId
  const isBusy = createMutation.isPending || updateMutation.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const payload = {
      name: name.trim(),
      prompt: prompt.trim(),
      agentId: tuple.agentId,
      modelId: tuple.modelId,
      workspacePath: tuple.workspacePath,
      reasoningEffort: tuple.reasoningEffort,
      schedule,
    }
    if (isExisting) {
      await updateMutation.mutateAsync({ id: taskId, ...payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    navigate({ to: '/tasks' })
  }

  async function handleDeleteConfirmed() {
    if (!taskId) return
    await deleteMutation.mutateAsync({ id: taskId })
    navigate({ to: '/tasks' })
  }

  async function togglePause() {
    if (!taskId) return
    const status = currentStatus ?? initial.status
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
          {mode === 'create' ? 'New scheduled task' : initial.name}
        </h1>
      </PageHeader>
      <div className="flex flex-1 overflow-hidden">
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-6 py-8">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="task-name">Name</FieldLabel>
                  <Input
                    id="task-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="morning-github"
                  />
                  <FieldDescription>
                    Short kebab-case name for this task.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="task-prompt">Prompt</FieldLabel>
                  <Textarea
                    id="task-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Summarise overnight GitHub activity across my repos…"
                    rows={4}
                  />
                </Field>

                <ScheduleField value={schedule} onChange={setSchedule} />

                <FieldSet>
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>Agent</FieldLabel>
                      <AgentPicker
                        value={tuple.agentId}
                        onChange={(agentId) =>
                          // Same invalidation rule as Composer: switching
                          // agent resets model + reasoning since their
                          // valid value sets are agent-specific.
                          setTuple({
                            ...tuple,
                            agentId,
                            modelId: null,
                            reasoningEffort: null,
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Model</FieldLabel>
                      <ModelPicker
                        agentId={tuple.agentId}
                        value={tuple.modelId}
                        onChange={(modelId) => setTuple({ ...tuple, modelId })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Workspace</FieldLabel>
                      <WorkspacePicker
                        value={tuple.workspacePath}
                        onChange={(workspacePath) =>
                          setTuple({ ...tuple, workspacePath })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Reasoning</FieldLabel>
                      <ReasoningPicker
                        agentId={tuple.agentId}
                        value={tuple.reasoningEffort}
                        onChange={(reasoningEffort) =>
                          setTuple({ ...tuple, reasoningEffort })
                        }
                      />
                    </Field>
                  </div>
                </FieldSet>

                <OutputsField />
              </FieldGroup>
            </div>
          </div>
          <PageFooter maxWidth="max-w-2xl">
            <Button type="submit" disabled={!canSave || isBusy}>
              {mode === 'create' ? 'Create task' : 'Save'}
            </Button>
            {isExisting && (
              <Button
                type="button"
                variant="outline"
                onClick={togglePause}
                disabled={isBusy}
              >
                {(currentStatus ?? initial.status) === 'active' ? (
                  <>
                    <PauseIcon data-icon="inline-start" /> Pause
                  </>
                ) : (
                  <>
                    <PlayIcon data-icon="inline-start" /> Resume
                  </>
                )}
              </Button>
            )}
            {isExisting && (
              <>
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isBusy}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2Icon data-icon="inline-start" />
                  Delete
                </Button>
              </>
            )}
          </PageFooter>
        </form>
        {isExisting && taskId && (
          <TaskRunSidebar taskId={taskId} draft={{ prompt, tuple }} />
        )}
      </div>
      {isExisting && (
        <DeleteTaskDialog
          open={confirmDelete}
          taskName={initial.name}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDeleteConfirmed}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-8">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}
