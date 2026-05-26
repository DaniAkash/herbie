import type { AgentId } from '@/modules/data/herbie-data.types'

// Mirrors PERMISSION_MODES in src/bun/routes/settings.ts. Declared
// here too so the renderer's tuple has a narrow union type without
// reaching across the bun↔renderer boundary at the type level. PATCH
// validation on the bun side is the runtime guard against drift.
export const PERMISSION_MODES = [
  'auto-approve-reads',
  'manual',
  'read-only',
  'allow-all',
] as const
export type PermissionMode = (typeof PERMISSION_MODES)[number]

// Shape mirrored on the bun side as ChatTuple — keep these aligned. The
// renderer narrows agentId to the typed enum; the bun side accepts any
// string so it doesn't gate on the renderer's enum drift.
export interface ComposerTuple {
  agentId: AgentId
  modelId: string | null
  workspacePath: string | null
  reasoningEffort: string | null
  permissionMode: PermissionMode
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
    a.reasoningEffort === b.reasoningEffort &&
    a.permissionMode === b.permissionMode
  )
}
