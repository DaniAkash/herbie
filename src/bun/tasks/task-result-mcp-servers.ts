import type { McpServerSpec } from '../chat/acpxProvider'
import { readSettings } from '../routes/settings'
import { taskResultServerSpec } from './task-result-server-spec'

// Build the McpServerSpec[] handed to acpx for a scheduled-task run:
// the user's globally-configured MCP servers (so the agent still has
// access to their filesystem / search / linear / etc. tools) plus
// the per-run herbie__task_result server keyed by the capture token.
export async function buildTaskRunMcpServers(
  captureToken: string,
  apiBaseUrl: string,
): Promise<McpServerSpec[]> {
  const settings = await readSettings()
  const userMcpServers = settings.mcp.servers.map(
    ({ id: _id, ...rest }) => rest,
  )
  return [...userMcpServers, taskResultServerSpec(captureToken, apiBaseUrl)]
}
