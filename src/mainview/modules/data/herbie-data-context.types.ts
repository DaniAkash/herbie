import type { AgentInfo, Workspace } from './herbie-data.types'

export type HerbieDataValue = {
  agents: AgentInfo[]
  workspaces: Workspace[]
}
