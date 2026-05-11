import type { AgentInfo, InboxItem, Workspace } from './herbie-data.types'

export type HerbieDataValue = {
  agents: AgentInfo[]
  workspaces: Workspace[]
  inboxItems: InboxItem[]
  setInboxItemStatus: (id: string, status: InboxItem['status']) => void
  toggleInboxStar: (id: string) => void
  deleteInboxItem: (id: string) => void
}
