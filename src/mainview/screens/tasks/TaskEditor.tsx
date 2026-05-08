import { useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, PauseIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { AgentPicker } from '@/components/chat/AgentPicker'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type {
  AgentId,
  ScheduleConfig,
  TaskOutput,
} from '@/modules/data/herbie-data.types'
import { ScheduleField } from './ScheduleField'

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

export function TaskEditor({
  mode,
  taskId,
  initialPrompt,
  initialAgent,
  initialWorkspaceId,
}: EditorProps) {
  const navigate = useNavigate()
  const { tasks, defaultAgent, createTask, updateTask, deleteTask } =
    useHerbieData()

  const existing = taskId ? tasks.find((t) => t.id === taskId) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [prompt, setPrompt] = useState(existing?.prompt ?? initialPrompt ?? '')
  const [agent, setAgent] = useState<AgentId>(
    existing?.agent ?? initialAgent ?? defaultAgent,
  )
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(
    existing?.workspaceId ?? initialWorkspaceId,
  )
  const [schedule, setSchedule] = useState<ScheduleConfig>(
    existing?.schedule ?? DEFAULT_SCHEDULE,
  )
  const [outputs, setOutputs] = useState<Set<TaskOutput>>(
    new Set(existing?.outputs ?? ['inbox']),
  )

  const canSave = name.trim().length > 0 && prompt.trim().length > 0

  function toggleOutput(o: TaskOutput) {
    setOutputs((prev) => {
      const next = new Set(prev)
      if (next.has(o)) next.delete(o)
      else next.add(o)
      return next
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const payload = {
      name: name.trim(),
      prompt: prompt.trim(),
      agent,
      workspaceId,
      schedule,
      outputs: [...outputs],
    }
    if (existing) updateTask({ id: existing.id, ...payload })
    else createTask(payload)
    navigate({ to: '/tasks' })
  }

  function handleDelete() {
    if (!existing) return
    deleteTask(existing.id)
    navigate({ to: '/tasks' })
  }

  function togglePause() {
    if (!existing) return
    updateTask({
      id: existing.id,
      status: existing.status === 'active' ? 'paused' : 'active',
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
          {mode === 'create' ? 'New scheduled task' : existing?.name}
        </h1>
      </PageHeader>
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
                <div className="grid grid-cols-2 gap-6">
                  <Field>
                    <FieldLabel>Agent</FieldLabel>
                    <AgentPicker
                      value={agent}
                      onChange={setAgent}
                      variant="header"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Workspace</FieldLabel>
                    <WorkspacePicker
                      value={workspaceId}
                      onChange={setWorkspaceId}
                      variant="header"
                    />
                  </Field>
                </div>
              </FieldSet>

              <Field>
                <FieldLabel>Send result to</FieldLabel>
                <div className="flex flex-col gap-1 divide-y divide-border rounded-lg border bg-card">
                  <OutputToggle
                    label="Inbox"
                    description="Land as a card in your Herbie inbox"
                    checked={outputs.has('inbox')}
                    onChange={() => toggleOutput('inbox')}
                  />
                  <OutputToggle
                    label="Telegram"
                    description="Send to your bound Telegram chat"
                    checked={outputs.has('telegram')}
                    onChange={() => toggleOutput('telegram')}
                  />
                </div>
              </Field>
            </FieldGroup>
          </div>
        </div>
        <PageFooter maxWidth="max-w-2xl">
          <Button type="submit" disabled={!canSave}>
            {mode === 'create' ? 'Create task' : 'Save'}
          </Button>
          {existing && (
            <Button type="button" variant="outline" onClick={togglePause}>
              {existing.status === 'active' ? (
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
          {existing && (
            <>
              <div className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2Icon data-icon="inline-start" />
                Delete
              </Button>
            </>
          )}
        </PageFooter>
      </form>
    </div>
  )
}

function OutputToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
    >
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </button>
  )
}
