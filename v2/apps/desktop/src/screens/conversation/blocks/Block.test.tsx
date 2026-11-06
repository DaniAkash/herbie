import { describe, expect, test } from 'bun:test'
import type { TranscriptRecord } from '@bun/shared/transcript'
import { renderToStaticMarkup } from 'react-dom/server'
import { Block } from '@/screens/conversation/blocks/Block'
import { EMPTY } from '@/screens/conversation/conversation.reducer'

const common = { id: '1', seq: 1, turn: 'turn', at: '2026-01-02T03:04:05.000Z' }

describe('message metadata', () => {
  for (const record of [
    { ...common, kind: 'user', text: 'Question' },
    { ...common, kind: 'say', text: 'Answer' },
    { ...common, kind: 'explain', text: 'Research answer' },
  ] as TranscriptRecord[]) {
    test(`shows timing for a keyboard-focusable ${record.kind} block`, () => {
      const html = renderToStaticMarkup(
        <Block
          record={record}
          thread={{
            ...EMPTY,
            turnStarts: { turn: Date.parse('2026-01-02T03:04:00.000Z') },
          }}
          agentName="Agent"
          onAnswer={() => {}}
          onDecide={() => {}}
        />,
      )
      expect(html).toContain('tabindex="0"')
      expect(html).toContain('dateTime="2026-01-02T03:04:05.000Z"')
      if (record.kind !== 'user') expect(html).toContain('Turn time 5s')
    })
  }
})
