import type { AgentId } from '@/modules/data/herbie-data.types'

// Shape mirrored on the bun side as ChatTuple — keep these aligned. The
// renderer narrows agentId to the typed enum; the bun side accepts any
// string so it doesn't gate on the renderer's enum drift.
export interface ComposerTuple {
  agentId: AgentId
  modelId: string | null
  workspacePath: string | null
  reasoningEffort: string | null
}

export function tuplesEqual(
  a: ComposerTuple,
  b: ComposerTuple | undefined,
): boolean {
  if (!b) return false
  return (
    a.agentId === b.agentId &&
    a.modelId === b.modelId &&
    a.workspacePath === b.workspacePath &&
    a.reasoningEffort === b.reasoningEffort
  )
}
