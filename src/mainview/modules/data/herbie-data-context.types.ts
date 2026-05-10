import type {
  AgentId,
  AgentInfo,
  InboxItem,
  ScheduleConfig,
  Task,
  TaskOutput,
  Workspace,
} from './herbie-data.types'

export type CreateTaskInput = {
  name: string
  prompt: string
  agent: AgentId
  workspaceId?: string
  schedule: ScheduleConfig
  outputs: TaskOutput[]
}

export type UpdateTaskInput = Partial<CreateTaskInput> & {
  id: string
  status?: 'active' | 'paused'
}

export type HerbieDataValue = {
  agents: AgentInfo[]
  workspaces: Workspace[]
  tasks: Task[]
  inboxItems: InboxItem[]
  createTask: (input: CreateTaskInput) => Task
  updateTask: (input: UpdateTaskInput) => void
  deleteTask: (id: string) => void
  setInboxItemStatus: (id: string, status: InboxItem['status']) => void
  toggleInboxStar: (id: string) => void
  deleteInboxItem: (id: string) => void
}
