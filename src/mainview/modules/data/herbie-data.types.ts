export type AgentId = 'claude' | 'codex' | 'gemini' | 'hermes'

export type AgentInfo = {
  id: AgentId
  label: string
  blurb: string
  status: 'ready' | 'signin-required' | 'not-installed'
}

export type Workspace = {
  id: string
  name: string
  path: string
  pinned?: boolean
}

export type ScheduleConfig =
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'interval'; hours: number }
  | { kind: 'weekly'; weekday: number; hour: number; minute: number }
  | { kind: 'cron'; cron: string }

export type TaskOutput = 'inbox' | 'telegram'

export type Task = {
  id: string
  name: string
  prompt: string
  agent: AgentId
  workspaceId?: string
  schedule: ScheduleConfig
  outputs: TaskOutput[]
  status: 'active' | 'paused'
  lastRunAt?: number
  nextRunAt?: number
  createdAt: number
}

export type InboxItemStatus = 'unread' | 'read' | 'done'

export type InboxItem = {
  id: string
  taskId: string
  taskName: string
  title: string
  body: string
  agent: AgentId
  workspaceId?: string
  status: InboxItemStatus
  starred: boolean
  createdAt: number
}
