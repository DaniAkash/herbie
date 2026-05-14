import type { ModelMessage } from 'ai'
import { asc, eq } from 'drizzle-orm'
import type { DB } from '../../db'
import { chatEvents } from '../../db/schema/chat-events.sql'

export interface ChatTuple {
  agentId: string
  modelId: string | null
  workspacePath: string | null
  reasoningEffort: string | null
}

export function tupleKey(t: ChatTuple): string {
  return `${t.agentId}::${t.modelId ?? '_'}::${t.workspacePath ?? '_'}::${t.reasoningEffort ?? '_'}`
}

export function tuplesEqual(a: ChatTuple | null, b: ChatTuple | null): boolean {
  if (!a || !b) return a === b
  return (
    a.agentId === b.agentId &&
    a.modelId === b.modelId &&
    a.workspacePath === b.workspacePath &&
    a.reasoningEffort === b.reasoningEffort
  )
}

// True when two tuples share the fields that mechanically force a new
// acpx child process. `agentId` and `workspacePath` are the only ones —
// `modelId` and `reasoningEffort` are live RPCs (`setConfigOption`) on
// an open session, so they can change in place. Used by ChatSession to
// pick between provider rebuild (Path A) and in-place config delta
// (Path C).
export function providerKeyEqual(
  a: ChatTuple | null,
  b: ChatTuple | null,
): boolean {
  if (!a || !b) return a === b
  return a.agentId === b.agentId && a.workspacePath === b.workspacePath
}

// Reads chat_events and projects them into a ModelMessage[] for the
// tuple-changed rebuild path. Tools and reasoning blocks aren't
// replayed — the new agent sees user/assistant text only (acceptable
// per the cross-agent-switching research).
//
// `excludeRequestId` skips any turn.start with that requestId so the
// caller can write the current turn.start to the event log first
// (status/UI bookkeeping) and still build a prompt that doesn't
// duplicate the new user message — the caller appends it once at the
// tail after this returns.
export async function rebuildMessagesFromLog(
  db: DB,
  conversationId: string,
  excludeRequestId?: string,
): Promise<ModelMessage[]> {
  const rows = await db
    .select()
    .from(chatEvents)
    .where(eq(chatEvents.conversationId, conversationId))
    .orderBy(asc(chatEvents.seq))
    .all()

  const messages: ModelMessage[] = []
  for (const row of rows) {
    const message = projectRow(row.type, row.payload, excludeRequestId)
    if (message) messages.push(message)
  }
  return messages
}

function projectRow(
  type: string,
  payload: string,
  excludeRequestId: string | undefined,
): ModelMessage | null {
  if (type !== 'turn.start' && type !== 'assistant.text') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }
  if (type === 'turn.start') {
    const p = parsed as { userMessage?: string; requestId?: string }
    if (excludeRequestId && p.requestId === excludeRequestId) return null
    return p.userMessage ? { role: 'user', content: p.userMessage } : null
  }
  const text = (parsed as { text?: string })?.text
  return text ? { role: 'assistant', content: text } : null
}
