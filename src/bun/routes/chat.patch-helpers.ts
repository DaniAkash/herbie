import type { conversations } from '../../db/schema/conversations.sql'

// Maps the validated PATCH body to the conversation row delta. Lives
// in its own file so chat.ts stays under the per-file line cap as
// patchSchema accumulates more fields (rename + pin + tuple +
// permission today, likely more later).
export interface PatchBody {
  title?: string
  pinned?: boolean
  agentId?: string
  modelId?: string | null
  workspacePath?: string | null
  reasoningEffort?: string | null
  permissionMode?: string
}

export function buildPatchUpdate(
  body: PatchBody,
): Partial<typeof conversations.$inferInsert> {
  const next: Partial<typeof conversations.$inferInsert> = {}
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
  if (body.permissionMode !== undefined) {
    next.permissionMode = body.permissionMode
  }
  // Only bump updatedAt for user-visible activity (rename / pin). The
  // sidebar orders by updatedAt, so picking a model / agent /
  // workspace / permission would otherwise re-bucket the conversation
  // to the top on every click — metadata changes shouldn't masquerade
  // as fresh activity. A send still bumps updatedAt via
  // setConversationStatus.
  if (body.title !== undefined || body.pinned !== undefined) {
    next.updatedAt = new Date()
  }
  return next
}
