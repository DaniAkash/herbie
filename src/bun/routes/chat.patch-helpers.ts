import type { conversations } from '../../db/schema/conversations.sql'

// Maps the validated PATCH body to the conversation row delta. Lives
// in its own file so chat.ts stays under the per-file line cap as
// patchSchema accumulates more fields (rename + pin + tuple today,
// likely more later).
export interface PatchBody {
  title?: string
  pinned?: boolean
  agentId?: string
  modelId?: string | null
  workspacePath?: string | null
  reasoningEffort?: string | null
}

export function buildPatchUpdate(
  body: PatchBody,
): Partial<typeof conversations.$inferInsert> {
  const next: Partial<typeof conversations.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (body.title !== undefined) next.title = body.title
  if (body.pinned !== undefined) {
    next.pinnedAt = body.pinned ? new Date() : null
  }
  if (body.agentId !== undefined) next.agentId = body.agentId
  if (body.modelId !== undefined) next.modelId = body.modelId
  if (body.workspacePath !== undefined) next.workspacePath = body.workspacePath
  if (body.reasoningEffort !== undefined) {
    next.reasoningEffort = body.reasoningEffort
  }
  return next
}
