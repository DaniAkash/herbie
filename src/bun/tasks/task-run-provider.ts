import type { AcpxProvider } from 'acpx-ai-provider'
import type { DB } from '../../db'
import { API_BASE_URL } from '../api-port'
import { buildAcpxProvider } from '../chat/acpxProvider'
import { readAgentCapability } from '../routes/settings'
import {
  getTaskResultCapture,
  type RegisteredCapture,
} from './task-result-capture'
import { buildTaskRunMcpServers } from './task-result-mcp-servers'

export interface TaskRunTuple {
  agentId: string
  modelId: string | null
  workspacePath: string | null
  reasoningEffort: string | null
}

export interface SpunUpProvider {
  provider: AcpxProvider
  capture: RegisteredCapture
}

// Builds + prepares the per-run AcpxProvider and registers the
// herbie__task_result MCP capture. Owned by TaskRunSession but
// extracted so the session class stays focused on lifecycle.
export async function spinUpTaskRunProvider(
  db: DB,
  args: { taskId: string; runId: string; tuple: TaskRunTuple },
): Promise<SpunUpProvider> {
  // sessionKey is unique per run — guarantees `usedKeys` miss on the
  // acpx side so the agent gets `mode: 'fresh'` and never sees prior
  // run state.
  const sessionKey = `__task-run::${args.taskId}::${args.runId}`

  // Register the per-run capture before the agent boots so the MCP
  // child can POST as soon as the agent calls the tool.
  const capture = getTaskResultCapture().registerRun(args.runId)
  const mcpServers = await buildTaskRunMcpServers(capture.token, API_BASE_URL)

  const provider = await buildAcpxProvider({
    conversationId: args.runId,
    agentId: args.tuple.agentId,
    workspacePath: args.tuple.workspacePath ?? undefined,
    sessionKey,
    mcpServers,
    // Scheduled tasks run unattended — there's no human to click an
    // approval card. `read-only` is the safest default: reads pass,
    // writes / shell / delete auto-reject. A future per-task picker
    // can let the user opt into broader trust for specific tasks.
    permissionMode: 'read-only',
    // No-op emit + active-turn lookup: task runs use a separate
    // task_run_events stream, not chat_events. `read-only` mode
    // auto-decides every request so the callback never escalates
    // and the no-op emit is never called.
    writeProtocolEvent: async () => {},
    getActiveTurnRequestId: () => null,
  })
  await provider.prepare()
  if (args.tuple.modelId) {
    await provider.setConfigOption('model', args.tuple.modelId)
  }
  if (args.tuple.reasoningEffort) {
    const cap = await readAgentCapability(db, args.tuple.agentId)
    const reasoningKey = cap?.reasoning?.key
    if (reasoningKey) {
      await provider.setConfigOption(reasoningKey, args.tuple.reasoningEffort)
    }
  }
  return { provider, capture }
}
