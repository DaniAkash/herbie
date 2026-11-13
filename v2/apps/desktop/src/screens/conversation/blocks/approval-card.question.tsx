import type { CSSProperties, Ref } from 'react'
import { cn } from '@/lib/utils'
import type { ApprovalQuestion } from '@/screens/conversation/blocks/ApprovalCard'
import { OptionMark } from '@/screens/conversation/blocks/approval-card.components'
import { GlideMenu } from '@/screens/conversation/blocks/GlideMenu'

const SLIDE = '360ms cubic-bezier(0.22, 1, 0.36, 1)'

const ROW_CLASS =
  'relative z-10 flex items-center gap-1.5 rounded-control py-1 pr-2 pl-1 transition-colors duration-100'

/**
 * One question in the stack: its options, and a row for an answer that is not
 * among them.
 *
 * Every question stays mounted and keeps its own box, because the card
 * measures the active one to decide its own height and translates the stack to
 * bring it into view. An inactive one is faded out and taken out of the tab
 * order rather than unmounted.
 */
export function ApprovalQuestionRow({
  question,
  active,
  mounted,
  animate,
  picked,
  custom,
  onPick,
  onCustomChange,
  onConfirm,
  itemRef,
}: {
  question: ApprovalQuestion
  active: boolean
  mounted: boolean
  animate: boolean
  picked: number[]
  custom: string
  onPick: (optionIndex: number) => void
  onCustomChange: (next: string) => void
  onConfirm: () => void
  itemRef: Ref<HTMLDivElement>
}) {
  if (!mounted) return null

  const style: CSSProperties = {
    opacity: active ? 1 : 0,
    transition: animate ? `opacity ${SLIDE}` : undefined,
    pointerEvents: active ? undefined : 'none',
  }

  return (
    <div ref={itemRef} aria-hidden={active ? undefined : true} style={style}>
      <div className="pr-7 font-medium text-[14px] text-ink">{question.q}</div>
      <GlideMenu
        className="mt-2.5 flex flex-col gap-1"
        highlightClassName="inset-x-0 rounded-control bg-hover"
      >
        {question.options.map((option, optionIndex) => {
          const on = picked.includes(optionIndex)
          return (
            <button
              key={option}
              type="button"
              data-menu-row
              aria-pressed={on}
              tabIndex={active ? 0 : -1}
              onClick={() => {
                if (active) onPick(optionIndex)
              }}
              className={cn(ROW_CLASS, 'text-left')}
            >
              <OptionMark kind={question.type} on={on} />
              <span
                className={cn(
                  'text-[13px] leading-none transition-colors duration-200',
                  on ? 'text-ink' : 'text-ink-2',
                )}
              >
                {option}
              </span>
            </button>
          )
        })}
        <label data-menu-row className={ROW_CLASS}>
          <input
            value={custom}
            tabIndex={active ? 0 : -1}
            onChange={(event) => {
              if (active) onCustomChange(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onConfirm()
              }
            }}
            placeholder="Something else…"
            aria-label="Custom answer"
            className="min-w-0 flex-1 bg-transparent pl-1.5 text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
        </label>
      </GlideMenu>
    </div>
  )
}
