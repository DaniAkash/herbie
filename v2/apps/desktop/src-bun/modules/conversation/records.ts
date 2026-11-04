import { publish } from '@bun/modules/conversation/bus'
import type { Transcript } from '@bun/modules/conversation/transcript'
import type { Db } from '@bun/modules/db/db'
import { transcriptCursors } from '@bun/modules/db/schema/schema'
import type { DraftRecord, TranscriptRecord } from '@bun/shared/transcript'

/**
 * Writing a record, which is three things that have to happen together.
 *
 * One place rather than three calls at each site: a record that reached the
 * file but not the bus is a thread that looks stalled until the next reload,
 * and one that reached neither the bus nor the cursor is an unread dot that
 * never appears.
 */

export interface RecordTarget {
  readonly agentId: string
  readonly transcript: Transcript
  /** The turn this block belongs to. */
  readonly turn: string
}

export function writeRecord(
  db: Db,
  target: RecordTarget,
  draft: DraftRecord,
): TranscriptRecord {
  const record = target.transcript.append(target.turn, draft)

  db.insert(transcriptCursors)
    .values({
      agentId: target.agentId,
      lastSeq: record.seq,
      lastAt: record.at,
      unreadFrom: record.seq,
    })
    .onConflictDoUpdate({
      target: transcriptCursors.agentId,
      set: { lastSeq: record.seq, lastAt: record.at },
    })
    .run()

  publish(target.agentId, record)
  return record
}

/**
 * Whether a record is something the person sees as a block.
 *
 * The lifecycle and activity records are not, which is what makes "this turn
 * reported nothing" a question worth asking: a turn that only set its
 * activity label has still left the person looking at silence.
 */
export function isBlock(kind: DraftRecord['kind']): boolean {
  return !(
    kind === 'activity' ||
    kind === 'turn.start' ||
    kind === 'turn.end' ||
    kind === 'user' ||
    kind === 'answer' ||
    kind === 'decision'
  )
}
