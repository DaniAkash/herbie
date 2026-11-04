import type { TranscriptRecord } from '@bun/shared/transcript'
import CodeBlock from '@/components/primitives/CodeBlock'

type Code = Extract<TranscriptRecord, { kind: 'show_code' }>

/**
 * A `show_code` block, as a diff when one was sent and a file when not.
 *
 * The component's own `pieces` array exists for per-token highlighting within
 * a changed line. The agent sends a line, so each row gets one piece: asking
 * it to split a line into spans would be asking it to do syntax highlighting
 * by hand.
 */
export function Code({ record }: { record: Code }) {
  if (record.diff && record.diff.length > 0) {
    return (
      <CodeBlock
        filename={record.filename}
        diff={record.diff.map((row) => ({
          old: row.old,
          cur: row.cur,
          type: row.type,
          pieces: [
            {
              text: row.text,
              ...(row.type === 'ctx' ? {} : { change: row.type }),
            },
          ],
        }))}
      />
    )
  }
  return (
    <CodeBlock
      filename={record.filename}
      lines={(record.code ?? '').split('\n')}
    />
  )
}
