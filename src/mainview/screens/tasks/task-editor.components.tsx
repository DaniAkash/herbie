import { PauseIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import {
  Controller,
  type FieldError as RHFFieldError,
  type UseFormReturn,
} from 'react-hook-form'
import { AgentPicker } from '@/components/chat/AgentPicker'
import { ModelPicker } from '@/components/chat/ModelPicker'
import { ReasoningPicker } from '@/components/chat/ReasoningPicker'
import { WorkspacePicker } from '@/components/chat/WorkspacePicker'
import { PageFooter } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { OutputsField } from './OutputsField'
import { ScheduleField } from './ScheduleField'
import { TaskRunSidebar } from './TaskRunSidebar'
import type { TaskFormValues } from './task-editor.schemas'

export type TaskForm = UseFormReturn<TaskFormValues>

// FieldError accepts an `errors` array, but in this form each field
// has at most one error. Wrap it so callers don't repeat the
// `x ? [x] : undefined` ternary.
function fieldErrors(err: RHFFieldError | undefined) {
  return err ? [err] : undefined
}

// Walk a (possibly nested) RHF error subtree and return the first
// leaf — i.e. the first node that has a `.message`. Used for the
// schedule field: zod attaches a discriminated-union `.refine` error
// at `errors.schedule.cron`, so the parent at `errors.schedule` has
// no `.message` and `FieldError` would render nothing. The same
// helper covers any future nested validators on schedule kinds.
function pickLeafError(node: unknown): RHFFieldError | undefined {
  if (!node || typeof node !== 'object') return undefined
  const obj = node as Record<string, unknown>
  if (typeof obj.message === 'string') return obj as unknown as RHFFieldError
  for (const value of Object.values(obj)) {
    const leaf = pickLeafError(value)
    if (leaf) return leaf
  }
  return undefined
}

export function TaskFormFields({ form }: { form: TaskForm }) {
  const errors = form.formState.errors
  return (
    <FieldGroup>
      <Field data-invalid={errors.name ? '' : undefined}>
        <FieldLabel htmlFor="task-name">Name</FieldLabel>
        <Input
          id="task-name"
          placeholder="morning-github"
          aria-invalid={errors.name ? true : undefined}
          {...form.register('name')}
        />
        <FieldDescription>
          Short kebab-case name for this task.
        </FieldDescription>
        <FieldError errors={fieldErrors(errors.name)} />
      </Field>

      <Field data-invalid={errors.prompt ? '' : undefined}>
        <FieldLabel htmlFor="task-prompt">Prompt</FieldLabel>
        <Textarea
          id="task-prompt"
          placeholder="Summarise overnight GitHub activity across my repos…"
          rows={4}
          aria-invalid={errors.prompt ? true : undefined}
          {...form.register('prompt')}
        />
        <FieldError errors={fieldErrors(errors.prompt)} />
      </Field>

      <Controller
        control={form.control}
        name="schedule"
        render={({ field }) => {
          // `fieldState.error` for a discriminated-union refine sits
          // at the union's path (e.g. errors.schedule.cron), so the
          // node at `errors.schedule` has no `.message`. Walk the
          // subtree for the leaf.
          const leaf = pickLeafError(errors.schedule)
          return (
            <Field data-invalid={leaf ? '' : undefined}>
              <ScheduleField value={field.value} onChange={field.onChange} />
              <FieldError errors={fieldErrors(leaf)} />
            </Field>
          )
        }}
      />

      <TupleFields form={form} />

      <OutputsField />
    </FieldGroup>
  )
}

function TupleFields({ form }: { form: TaskForm }) {
  return (
    <FieldSet>
      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={form.control}
          name="agentId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.error ? '' : undefined}>
              <FieldLabel>Agent</FieldLabel>
              <AgentPicker
                value={field.value}
                onChange={(agentId) => {
                  // Switching agent invalidates model + reasoning
                  // since their valid value sets are agent-specific
                  // (same rule as the chat Composer).
                  field.onChange(agentId)
                  form.setValue('modelId', null)
                  form.setValue('reasoningEffort', null)
                }}
              />
              <FieldError errors={fieldErrors(fieldState.error)} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="modelId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.error ? '' : undefined}>
              <FieldLabel>Model</FieldLabel>
              <ModelPicker
                agentId={form.watch('agentId')}
                value={field.value}
                onChange={field.onChange}
              />
              <FieldError errors={fieldErrors(fieldState.error)} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="workspacePath"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.error ? '' : undefined}>
              <FieldLabel>Workspace</FieldLabel>
              <WorkspacePicker value={field.value} onChange={field.onChange} />
              <FieldError errors={fieldErrors(fieldState.error)} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="reasoningEffort"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.error ? '' : undefined}>
              <FieldLabel>Reasoning</FieldLabel>
              <ReasoningPicker
                agentId={form.watch('agentId')}
                value={field.value}
                onChange={field.onChange}
              />
              <FieldError errors={fieldErrors(fieldState.error)} />
            </Field>
          )}
        />
      </div>
    </FieldSet>
  )
}

export function EditorFooter({
  mode,
  isExisting,
  isBusy,
  status,
  onTogglePause,
  onRequestDelete,
}: {
  mode: 'create' | 'edit'
  isExisting: boolean
  isBusy: boolean
  status: 'active' | 'paused'
  onTogglePause: () => void
  onRequestDelete: () => void
}) {
  return (
    <PageFooter maxWidth="max-w-2xl">
      <Button type="submit" disabled={isBusy}>
        {mode === 'create' ? 'Create task' : 'Save'}
      </Button>
      {isExisting && (
        <Button
          type="button"
          variant="outline"
          onClick={onTogglePause}
          disabled={isBusy}
        >
          {status === 'active' ? (
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
            onClick={onRequestDelete}
            disabled={isBusy}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
        </>
      )}
    </PageFooter>
  )
}

export function EditorSidebar({
  form,
  taskId,
  onCreateAndNavigate,
}: {
  form: TaskForm
  taskId: string | null
  // Persists the draft, navigates to the new edit URL, and returns
  // the new id. Used by the sidebar's `onBeforeTest` in create mode.
  onCreateAndNavigate: () => Promise<string>
}) {
  const v = form.watch()
  const draft = {
    prompt: v.prompt,
    tuple: {
      agentId: v.agentId,
      modelId: v.modelId,
      workspacePath: v.workspacePath,
      reasoningEffort: v.reasoningEffort,
    },
  }
  if (taskId != null) {
    return <TaskRunSidebar taskId={taskId} draft={draft} />
  }
  // Create mode: Test takes a save-then-test-then-navigate path.
  // `onBeforeTest` runs the form validator so any missing/invalid
  // field surfaces inline messages before we attempt to persist.
  return (
    <TaskRunSidebar
      taskId={null}
      draft={draft}
      onBeforeTest={async () => {
        const ok = await form.trigger()
        if (!ok) return null
        return onCreateAndNavigate()
      }}
    />
  )
}

export function EditorSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-8">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}
