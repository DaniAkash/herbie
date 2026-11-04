import { appendFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DraftRecord, TranscriptRecord } from '@bun/shared/transcript'

/**
 * The person's thread, as append-only jsonl in the agent's own folder.
 *
 * ```text
 * <workspaceDir>/.herbie/
 * ├── transcript/0001.jsonl     1000 records per segment
 * └── raw/<turnId>.jsonl        the acpx event stream, for debugging only
 * ```
 *
 * Not rows in the shared database, and not only because the brief asks for
 * files: a block's payload is a component's props, which is a shape the UI
 * owns and a schema would fight. Append-only means a crash mid-turn costs the
 * last line and nothing before it.
 *
 * This is not the agent's memory. acpx keeps the full session record, every
 * message and every tool result, under its own state directory. The two
 * diverge on purpose, because compaction shortens what the agent carries and
 * the person's thread should not lose its history when that happens.
 *
 * Nothing is ever rewritten. An `ask` that gets answered is followed by an
 * `answer` record naming it, and a `permission` that gets decided by a
 * `decision` record, which the reducer folds back on. Editing a line in place
 * would mean the file is no longer append-only, and append-only is the whole
 * reason it is safe to write from a process that drives coding agents.
 */

/** Records per file. Small enough to read one, large enough to be rare. */
const SEGMENT_SIZE = 1000

function transcriptDir(workspaceDir: string): string {
  return join(workspaceDir, '.herbie', 'transcript')
}

function rawDir(workspaceDir: string): string {
  return join(workspaceDir, '.herbie', 'raw')
}

function segmentName(index: number): string {
  return `${String(index).padStart(4, '0')}.jsonl`
}

/** Which file a sequence number lives in. One-based, like the names. */
function segmentOf(seq: number): number {
  return Math.floor((seq - 1) / SEGMENT_SIZE) + 1
}

export interface Transcript {
  /** Writes one block and gives it its place in the order. */
  append: (turn: string, draft: DraftRecord) => TranscriptRecord
  /** Every record after `after`, in order. Pass -1 for the whole thread. */
  read: (after: number) => TranscriptRecord[]
  /** The acpx event stream for one turn, kept for debugging and nothing else. */
  appendRaw: (turn: string, event: unknown) => void
  readonly lastSeq: number
}

/**
 * One writer per agent, because append-only ordering needs one.
 *
 * Keyed on the workspace directory rather than the agent id, since the
 * directory is what is actually being written to and two agents cannot share
 * one. Held for the life of the process: the sequence number is the only
 * state, and re-deriving it from disk on every append would mean reading the
 * last segment once per block.
 */
const open = new Map<string, Transcript>()

export function openTranscript(workspaceDir: string): Transcript {
  const existing = open.get(workspaceDir)
  if (existing) return existing
  const transcript = create(workspaceDir)
  open.set(workspaceDir, transcript)
  return transcript
}

/** Drops the cached writers, so a test can point at a fresh directory. */
export function resetTranscripts(): void {
  open.clear()
}

function create(workspaceDir: string): Transcript {
  const dir = transcriptDir(workspaceDir)
  sealPartialTail(dir)
  let seq = lastSeqOnDisk(dir)

  const transcript: Transcript = {
    get lastSeq() {
      return seq
    },

    append(turn, draft) {
      seq += 1
      const record = {
        seq,
        id: `r_${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        at: new Date().toISOString(),
        turn,
        ...draft,
      } as TranscriptRecord

      mkdirSync(dir, { recursive: true })
      appendFileSync(
        join(dir, segmentName(segmentOf(seq))),
        `${JSON.stringify(record)}\n`,
        'utf8',
      )
      return record
    },

    read(after) {
      const records: TranscriptRecord[] = []
      for (const index of segments(dir)) {
        // A whole segment below the cursor cannot hold anything wanted, so it
        // is skipped without being opened. This is what keeps a reconnect at
        // the live edge from reading a long thread back off the disk.
        if (index * SEGMENT_SIZE <= after) continue
        for (const line of readSegment(dir, index)) {
          if (line.seq > after) records.push(line)
        }
      }
      return records
    },

    appendRaw(turn, event) {
      const raw = rawDir(workspaceDir)
      mkdirSync(raw, { recursive: true })
      appendFileSync(
        join(raw, `${turn}.jsonl`),
        `${JSON.stringify({ at: new Date().toISOString(), event })}\n`,
        'utf8',
      )
    },
  }
  return transcript
}

/**
 * Closes a record that a crash left without its newline.
 *
 * The reader already drops that half line, so the record is gone either way.
 * What it cannot do is stop the next append landing on the same line: the
 * two then concatenate into one unparsable line and the good record is lost
 * along with the broken one. Ending the line here costs one byte and keeps
 * the damage to the write that was actually interrupted.
 */
function sealPartialTail(dir: string): void {
  const present = segments(dir)
  const last = present[present.length - 1]
  if (last === undefined) return

  const path = join(dir, segmentName(last))
  try {
    const text = readFileSync(path, 'utf8')
    if (text.length === 0 || text.endsWith('\n')) return
    appendFileSync(path, '\n', 'utf8')
  } catch {
    // Unreadable here means unreadable to the reader too, which already
    // treats a missing segment as empty. An append will recreate it.
  }
}

/** The segment indices present, in order. */
function segments(dir: string): number[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names
    .filter((name) => /^\d{4}\.jsonl$/.test(name))
    .map((name) => Number.parseInt(name.slice(0, 4), 10))
    .sort((a, b) => a - b)
}

/**
 * One segment's records.
 *
 * A trailing partial line is dropped rather than throwing. The one way this
 * file can be malformed is a crash between the write and the newline, and
 * losing the block that was being written is the cost already accepted by
 * writing append-only. Refusing to open the thread over it is not.
 */
function readSegment(dir: string, index: number): TranscriptRecord[] {
  let text: string
  try {
    text = readFileSync(join(dir, segmentName(index)), 'utf8')
  } catch {
    return []
  }
  const records: TranscriptRecord[] = []
  for (const line of text.split('\n')) {
    if (!line) continue
    try {
      records.push(JSON.parse(line) as TranscriptRecord)
    } catch {
      // A half-written last line. Nothing after it exists to lose.
    }
  }
  return records
}

function lastSeqOnDisk(dir: string): number {
  const present = segments(dir)
  const last = present[present.length - 1]
  if (last === undefined) return 0
  const records = readSegment(dir, last)
  return records[records.length - 1]?.seq ?? (last - 1) * SEGMENT_SIZE
}

export { SEGMENT_SIZE }
