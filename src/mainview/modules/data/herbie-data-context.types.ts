import type {
  AgentId,
  AgentInfo,
  Conversation,
  InboxItem,
  Message,
  ScheduleConfig,
  Task,
  TaskOutput,
  Workspace,
} from './herbie-data.types'

export type CreateConversationInput = {
  id?: string
  title?: string
  defaultAgent: AgentId
  workspaceId?: string
  origin?: 'desktop' | 'mobile'
  initialAssistantMessage?: {
    body: string
    agent: AgentId
    fromTaskId?: string
  }
}

export type AppendMessageInput = {
  conversationId: string
  role: 'user' | 'assistant'
  text: string
  agent?: AgentId
}

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
  conversations: Conversation[]
  messages: Message[]
  tasks: Task[]
  inboxItems: InboxItem[]
  createConversation: (input: CreateConversationInput) => Conversation
  setConversationAgent: (id: string, agent: AgentId) => void
  setConversationWorkspace: (
    id: string,
    workspaceId: string | undefined,
  ) => void
  appendMessage: (input: AppendMessageInput) => Message
  createTask: (input: CreateTaskInput) => Task
  updateTask: (input: UpdateTaskInput) => void
  deleteTask: (id: string) => void
  setInboxItemStatus: (id: string, status: InboxItem['status']) => void
  toggleInboxStar: (id: string) => void
  deleteInboxItem: (id: string) => void
  continueInboxItemInChat: (id: string) => Conversation
}
