import type { AcpxProvider } from 'acpx-ai-provider'
import { eq } from 'drizzle-orm'
import type { DB } from '../../db'
import {
  type Conversation,
  conversations,
} from '../../db/schema/conversations.sql'
import type { ChatTuple } from './tuple'

export async function setConversationStatus(
  db: DB,
  conv: Conversation,
  status: Conversation['status'],
): Promise<Conversation> {
  const updatedAt = new Date()
  await db
    .update(conversations)
    .set({ status, updatedAt })
    .where(eq(conversations.id, conv.id))
    .run()
  return { ...conv, status, updatedAt }
}

// Conversation row's tuple columns track the user's last choice so a
// re-open of the conversation defaults the composer to that tuple.
export async function persistTuple(
  db: DB,
  conv: Conversation,
  tuple: ChatTuple,
): Promise<Conversation> {
  const unchanged =
    conv.agentId === tuple.agentId &&
    conv.modelId === tuple.modelId &&
    conv.workspacePath === tuple.workspacePath &&
    conv.reasoningEffort === tuple.reasoningEffort
  if (unchanged) return conv

  const updatedAt = new Date()
  const next = {
    agentId: tuple.agentId,
    modelId: tuple.modelId,
    workspacePath: tuple.workspacePath,
    reasoningEffort: tuple.reasoningEffort,
  }
  await db
    .update(conversations)
    .set({ ...next, updatedAt })
    .where(eq(conversations.id, conv.id))
    .run()
  return { ...conv, ...next, updatedAt }
}

// Best-effort: if the provider's handle isn't ready, leave the row's
// acpx ids alone — the next turn will retry. Caller should swallow.
export async function persistAcpxIds(
  db: DB,
  conv: Conversation,
  provider: AcpxProvider,
): Promise<Conversation> {
  const { handle } = await provider.ensureHandle()
  const status = await provider.runtime.getStatus?.({ handle })
  const next = {
    acpxSessionId: handle.runtimeSessionName ?? null,
    acpxRecordId: status?.acpxRecordId ?? handle.acpxRecordId ?? null,
    agentSessionId: status?.agentSessionId ?? handle.agentSessionId ?? null,
  }
  await db
    .update(conversations)
    .set({ ...next, updatedAt: new Date() })
    .where(eq(conversations.id, conv.id))
    .run()
  return { ...conv, ...next }
}
