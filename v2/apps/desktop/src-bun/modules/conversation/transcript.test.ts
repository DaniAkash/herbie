import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  openTranscript,
  resetTranscripts,
  SEGMENT_SIZE,
} from '@bun/modules/conversation/transcript'

function workspace(): string {
  return mkdtempSync(join(tmpdir(), 'herbie-transcript-'))
}

afterEach(resetTranscripts)

describe('the transcript', () => {
  test('numbers records from one and reads them back in order', () => {
    const dir = workspace()
    const transcript = openTranscript(dir)
    transcript.append('t_1', { kind: 'user', text: 'draft today posts' })
    transcript.append('t_1', { kind: 'say', text: 'Five drafts.' })

    const records = transcript.read(-1)
    expect(records.map((r) => r.seq)).toEqual([1, 2])
    expect(records[0]).toMatchObject({ kind: 'user', turn: 't_1' })
    expect(transcript.lastSeq).toBe(2)
  })

  test('reads only what is after the cursor', () => {
    const transcript = openTranscript(workspace())
    for (let n = 0; n < 5; n += 1) {
      transcript.append('t_1', { kind: 'say', text: `line ${n}` })
    }
    expect(transcript.read(3).map((r) => r.seq)).toEqual([4, 5])
    expect(transcript.read(5)).toEqual([])
  })

  test('keeps the payload a block was written with', () => {
    const transcript = openTranscript(workspace())
    const written = transcript.append('t_1', {
      kind: 'show_tasks',
      rows: [{ label: 'Draft', status: 'running', amount: '5' }],
    })
    const [read] = transcript.read(0)
    expect(read).toEqual(written)
  })

  test('rolls over to a second segment and still reads as one thread', () => {
    const dir = workspace()
    const transcript = openTranscript(dir)
    for (let n = 0; n < SEGMENT_SIZE + 2; n += 1) {
      transcript.append('t_1', { kind: 'say', text: `line ${n}` })
    }
    expect(transcript.read(-1)).toHaveLength(SEGMENT_SIZE + 2)
    expect(transcript.read(SEGMENT_SIZE).map((r) => r.seq)).toEqual([
      SEGMENT_SIZE + 1,
      SEGMENT_SIZE + 2,
    ])
    expect(
      readFileSync(join(dir, '.herbie/transcript/0002.jsonl'), 'utf8')
        .trimEnd()
        .split('\n'),
    ).toHaveLength(2)
  })

  test('picks the sequence back up from disk in a new process', () => {
    const dir = workspace()
    openTranscript(dir).append('t_1', { kind: 'say', text: 'before' })
    resetTranscripts()

    const reopened = openTranscript(dir)
    expect(reopened.lastSeq).toBe(1)
    expect(reopened.append('t_2', { kind: 'say', text: 'after' }).seq).toBe(2)
  })

  test('survives a line left half written by a crash', () => {
    const dir = workspace()
    openTranscript(dir).append('t_1', { kind: 'say', text: 'whole' })
    resetTranscripts()

    const file = join(dir, '.herbie/transcript/0001.jsonl')
    writeFileSync(file, `${readFileSync(file, 'utf8')}{"seq":2,"kind":"sa`)

    // The block being written is lost, which is the cost already accepted by
    // appending. Refusing to open the thread over it is not.
    const reopened = openTranscript(dir)
    expect(reopened.read(-1)).toHaveLength(1)
    expect(reopened.lastSeq).toBe(1)
  })

  test('reads as empty before anything has been written', () => {
    const transcript = openTranscript(workspace())
    expect(transcript.read(-1)).toEqual([])
    expect(transcript.lastSeq).toBe(0)
  })

  test('keeps the raw event stream per turn, away from the thread', () => {
    const dir = workspace()
    const transcript = openTranscript(dir)
    transcript.appendRaw('t_9x', { type: 'text_delta', text: 'hm' })
    const raw = readFileSync(join(dir, '.herbie/raw/t_9x.jsonl'), 'utf8')
    expect(JSON.parse(raw.trim()).event).toEqual({
      type: 'text_delta',
      text: 'hm',
    })
    expect(transcript.read(-1)).toEqual([])
  })

  test('keeps the record written after a crash cut the previous one short', () => {
    const dir = workspace()
    const segment = join(dir, '.herbie', 'transcript')
    mkdirSync(segment, { recursive: true })
    // A write interrupted between the record and its newline.
    writeFileSync(
      join(segment, '0001.jsonl'),
      '{"seq":1,"id":"a","at":"t","turn":"t_1","kind":"say","text":"one"}\n' +
        '{"seq":2,"id":"b","at":"t","turn":"t_1","kind":"say","te',
      'utf8',
    )

    const transcript = openTranscript(dir)
    transcript.append('t_1', { kind: 'say', text: 'after the crash' })

    // The torn record is gone either way. The one after it must not be:
    // appended onto the same line, the two would merge and both be lost.
    const texts = transcript.read(0).map((r) => (r as { text: string }).text)
    expect(texts).toEqual(['one', 'after the crash'])
  })
})
