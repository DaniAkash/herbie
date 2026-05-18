import { and, eq, inArray } from 'drizzle-orm'
import { attachments } from '../../db/schema/attachments.sql'
import type { Conversation } from '../../db/schema/conversations.sql'
import type { ChatTuple } from '../chat/ChatSession'
import { getDb } from '../db-singleton'

// Resolves the per-send tuple: explicit fields override; `undefined`
// keeps the persisted value; `null` is an explicit "clear back to
// agent default" (so `??` would be wrong here — it would collapse
// `null` to the persisted value).
export interface SendTupleBody {
  agentId?: string
  modelId?: string | null
  workspacePath?: string | null
  reasoningEffort?: string | null
}

export function mergeSendTuple(
  body: SendTupleBody,
  conv: Conversation,
): ChatTuple {
  return {
    agentId: body.agentId ?? conv.agentId,
    modelId: body.modelId === undefined ? conv.modelId : body.modelId,
    workspacePath:
      body.workspacePath === undefined
        ? conv.workspacePath
        : body.workspacePath,
    reasoningEffort:
      body.reasoningEffort === undefined
        ? conv.reasoningEffort
        : body.reasoningEffort,
  }
}

// Scope attachment lookup to the conversation so ids from another
// chat can't be smuggled in. Returns null if any id is unknown so the
// caller can 400 cleanly.
export async function loadConvAttachments(
  conversationId: string,
  ids: string[],
): Promise<(typeof attachments.$inferSelect)[] | null> {
  if (ids.length === 0) return []
  const rows = await getDb()
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.conversationId, conversationId),
        inArray(attachments.id, ids),
      ),
    )
    .all()
  return rows.length === ids.length ? rows : null
}
