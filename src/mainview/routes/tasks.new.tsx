import { createFileRoute } from '@tanstack/react-router'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { TaskEditor } from '@/screens/tasks/TaskEditor'

type TaskNewSearch = {
  prompt?: string
  agent?: AgentId
  // Filesystem path of the preselected workspace, as exposed by
  // WorkspacePicker. The chat composer's Schedule button forwards
  // `tuple.workspacePath` here.
  workspacePath?: string
}

function NewTaskRoute() {
  const search = Route.useSearch()
  return (
    <TaskEditor
      mode="create"
      initialPrompt={search.prompt}
      initialAgent={search.agent}
      initialWorkspacePath={search.workspacePath}
    />
  )
}

export const Route = createFileRoute('/tasks/new')({
  validateSearch: (search: Record<string, unknown>): TaskNewSearch => {
    const agent = search.agent
    const validAgents = ['claude', 'codex', 'gemini', 'hermes'] as const
    return {
      prompt: typeof search.prompt === 'string' ? search.prompt : undefined,
      agent:
        typeof agent === 'string' &&
        (validAgents as readonly string[]).includes(agent)
          ? (agent as AgentId)
          : undefined,
      workspacePath:
        typeof search.workspacePath === 'string'
          ? search.workspacePath
          : undefined,
    }
  },
  component: NewTaskRoute,
})
