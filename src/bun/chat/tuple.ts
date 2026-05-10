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

// Reads chat_events and projects them into a ModelMessage[] for the
// tuple-changed rebuild path. Tools and reasoning blocks aren't
// replayed — the new agent sees user/assistant text only (acceptable
// per the cross-agent-switching research).
export async function rebuildMessagesFromLog(
  db: DB,
  conversationId: string,
): Promise<ModelMessage[]> {
  const rows = await db
    .select()
    .from(chatEvents)
    .where(eq(chatEvents.conversationId, conversationId))
    .orderBy(asc(chatEvents.seq))
    .all()

  const messages: ModelMessage[] = []
  for (const row of rows) {
    const message = projectRow(row.type, row.payload)
    if (message) messages.push(message)
  }
  return messages
}

function projectRow(type: string, payload: string): ModelMessage | null {
  if (type !== 'turn.start' && type !== 'assistant.text') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }
  if (type === 'turn.start') {
    const text = (parsed as { userMessage?: string })?.userMessage
    return text ? { role: 'user', content: text } : null
  }
  const text = (parsed as { text?: string })?.text
  return text ? { role: 'assistant', content: text } : null
}
