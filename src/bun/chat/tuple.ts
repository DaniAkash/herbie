import type { ModelMessage } from 'ai'
import { asc, eq, inArray } from 'drizzle-orm'
import type { DB } from '../../db'
import { attachments } from '../../db/schema/attachments.sql'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { buildUserMessage } from './user-message'

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
interface ParsedRow {
  type: string
  parsed: unknown
}

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

  // Two-pass: parse + collect attachment ids first, batch-fetch the
  // attachment rows, then project. Avoids N round-trips when a
  // conversation has many attachments.
  const parsedRows = parseLogRows(rows)
  const attachmentById = await loadAttachmentsForLog(db, parsedRows)
  return projectParsedRows(parsedRows, attachmentById, excludeRequestId)
}

function parseLogRows(
  rows: Array<{ type: string; payload: string }>,
): ParsedRow[] {
  const out: ParsedRow[] = []
  for (const row of rows) {
    if (row.type !== 'turn.start' && row.type !== 'assistant.text') continue
    try {
      out.push({ type: row.type, parsed: JSON.parse(row.payload) })
    } catch {
      // corrupt row — skip
    }
  }
  return out
}

async function loadAttachmentsForLog(
  db: DB,
  parsedRows: ParsedRow[],
): Promise<Map<string, typeof attachments.$inferSelect>> {
  const ids = new Set<string>()
  for (const { type, parsed } of parsedRows) {
    if (type !== 'turn.start') continue
    const p = parsed as { attachmentIds?: string[] }
    for (const id of p.attachmentIds ?? []) ids.add(id)
  }
  if (ids.size === 0) return new Map()
  const rows = await db
    .select()
    .from(attachments)
    .where(inArray(attachments.id, [...ids]))
    .all()
  return new Map(rows.map((a) => [a.id, a]))
}

async function projectParsedRows(
  parsedRows: ParsedRow[],
  attachmentById: Map<string, typeof attachments.$inferSelect>,
  excludeRequestId: string | undefined,
): Promise<ModelMessage[]> {
  const messages: ModelMessage[] = []
  for (const { type, parsed } of parsedRows) {
    if (type === 'turn.start') {
      const message = await projectTurnStart(
        parsed,
        attachmentById,
        excludeRequestId,
      )
      if (message) messages.push(message)
      continue
    }
    const text = (parsed as { text?: string })?.text
    if (text) messages.push({ role: 'assistant', content: text })
  }
  return messages
}

async function projectTurnStart(
  parsed: unknown,
  attachmentById: Map<string, typeof attachments.$inferSelect>,
  excludeRequestId: string | undefined,
): Promise<ModelMessage | null> {
  const p = parsed as {
    userMessage?: string
    requestId?: string
    attachmentIds?: string[]
  }
  if (excludeRequestId && p.requestId === excludeRequestId) return null
  if (!p.userMessage) return null
  const atts = (p.attachmentIds ?? [])
    .map((id) => attachmentById.get(id))
    .filter((a) => a !== undefined)
  return buildUserMessage(p.userMessage, atts)
}
