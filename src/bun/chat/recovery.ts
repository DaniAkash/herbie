import { asc, eq, inArray } from 'drizzle-orm'
import type { DB } from '../../db'
import { chatEvents } from '../../db/schema/chat-events.sql'
import { conversations } from '../../db/schema/conversations.sql'

const TERMINAL_TURN_TYPES = new Set([
  'turn.finish',
  'turn.cancel',
  'turn.error',
])

// On boot, scan for conversations whose event log shows an unterminated
// turn (turn.start with no matching turn.finish/cancel/error) and close
// the loop by appending a synthetic turn.cancel. Two paths produce this
// state:
//
//   1. Pre-fix builds where a thrown error in provider startup never
//      reached the per-turn try/catch.
//   2. Hard process death (SIGKILL, OOM, power loss) that skips the
//      graceful shutdown handler — the row's status flip alone doesn't
//      reach the reducer, which derives isStreaming from the event log.
//
// The shutdown handler still flips status='streaming' to 'idle' for the
// happy quit path; this is the belt that catches the suspender's gaps.
export async function recoverInterruptedTurns(db: DB): Promise<void> {
  // Two surfaces to scan: rows still flagged streaming AND rows the
  // shutdown handler already flipped to idle. The reducer cares about
  // dangling events regardless of row status.
  const rows = await db
    .select({ id: conversations.id, status: conversations.status })
    .from(conversations)
    .where(inArray(conversations.status, ['streaming', 'cancelled']))
    .all()

  for (const row of rows) {
    await closeDanglingTurn(db, row.id)
  }
}

async function closeDanglingTurn(
  db: DB,
  conversationId: string,
): Promise<void> {
  const events = await db
    .select()
    .from(chatEvents)
    .where(eq(chatEvents.conversationId, conversationId))
    .orderBy(asc(chatEvents.seq))
    .all()

  let lastTurnStart: { seq: number; requestId: string } | null = null
  for (const e of events) {
    if (e.type === 'turn.start') {
      const payload = safeParseRequestId(e.payload)
      if (payload) lastTurnStart = { seq: e.seq, requestId: payload }
    } else if (lastTurnStart && TERMINAL_TURN_TYPES.has(e.type)) {
      // A terminal event after the latest turn.start — turn already
      // closed; nothing to do.
      lastTurnStart = null
    }
  }
  if (!lastTurnStart) {
    // Either no turns at all or the last one closed cleanly. Still flip
    // the row to idle if it was streaming, since whatever set it is no
    // longer running.
    await db
      .update(conversations)
      .set({ status: 'idle', updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
      .run()
    return
  }

  const nextSeq = (events.at(-1)?.seq ?? -1) + 1
  const createdAt = new Date()
  const payload = {
    requestId: lastTurnStart.requestId,
    reason: 'session interrupted',
  }
  await db
    .insert(chatEvents)
    .values({
      conversationId,
      seq: nextSeq,
      type: 'turn.cancel',
      payload: JSON.stringify(payload),
      createdAt,
    })
    .run()
  await db
    .update(conversations)
    .set({ status: 'idle', updatedAt: createdAt })
    .where(eq(conversations.id, conversationId))
    .run()
}

function safeParseRequestId(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { requestId?: unknown }
    return typeof parsed.requestId === 'string' ? parsed.requestId : null
  } catch {
    return null
  }
}
