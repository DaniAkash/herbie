import { useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, PauseIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { AgentPicker } from '@/components/chat/AgentPicker'
import { WorkspacePicker } from '@/components/chat/WorkspacePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type EditorProps = {
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
      <header className="flex items-center gap-2 border-border border-b bg-background/95 px-6 py-3 backdrop-blur">
        <LinkButton
          to="/tasks"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Tasks
        </LinkButton>
        <h1 className="ml-2 font-semibold text-base">
          {mode === 'create' ? 'New scheduled task' : existing?.name}
        </h1>
      </header>
      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
            <Field label="Name" htmlFor="task-name">
              <Input
                id="task-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="morning-github"
              />
            </Field>

            <Field label="Prompt" htmlFor="task-prompt">
              <Textarea
                id="task-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Summarise overnight GitHub activity across my repos…"
                rows={4}
              />
            </Field>

            <ScheduleField value={schedule} onChange={setSchedule} />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Agent">
                <AgentPicker
                  value={agent}
                  onChange={setAgent}
                  variant="header"
                />
              </Field>
              <Field label="Workspace">
                <WorkspacePicker
                  value={workspaceId}
                  onChange={setWorkspaceId}
                  variant="header"
                />
              </Field>
            </div>

            <Field label="Send result to">
              <div className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3">
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
          </div>
        </div>
        <footer className="flex items-center gap-2 border-border border-t bg-background/95 px-6 py-3 backdrop-blur">
          <Button type="submit" disabled={!canSave}>
            {mode === 'create' ? 'Create task' : 'Save'}
          </Button>
          {existing && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={togglePause}
                className="gap-1.5"
              >
                {existing.status === 'active' ? (
                  <>
                    <PauseIcon className="h-4 w-4" /> Pause
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4" /> Resume
                  </>
                )}
              </Button>
              <div className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2Icon className="h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </footer>
      </form>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor} className="font-medium text-sm">
        {label}
      </Label>
      {children}
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
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
