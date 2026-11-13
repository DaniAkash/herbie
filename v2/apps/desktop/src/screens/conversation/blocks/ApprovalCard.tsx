import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AnswersSent,
  Ico,
  RollingDigits,
} from '@/screens/conversation/blocks/approval-card.components'
import { ApprovalQuestionRow } from '@/screens/conversation/blocks/approval-card.question'

export interface ApprovalQuestion {
  q: string
  type: 'radio' | 'check'
  options: string[]
}

export interface ApprovalLabels {
  send: string
  sentMessage: string
}

const SLIDE = '360ms cubic-bezier(0.22, 1, 0.36, 1)'

/** How long a single-choice answer is left visible before it advances. */
const AUTO_ADVANCE_MS = 480

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * One question at a time, out of however many the agent asked.
 *
 * The stack translates vertically between questions while the card's height
 * animates to fit, so the card never jumps. A single-choice answer advances by
 * itself after a beat; a multi-select waits to be confirmed.
 */
export function ApprovalCard({
  questions,
  labels,
  onSubmitted,
}: {
  questions: ApprovalQuestion[]
  labels: ApprovalLabels
  onSubmitted: (answers: Record<number, number[]>) => void
}) {
  const [at, setAt] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number[]>>({})
  const [custom, setCustom] = useState<Record<number, string>>({})
  const [sent, setSent] = useState(false)
  const [open, setOpen] = useState(true)

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const questionRefs = useRef<(HTMLDivElement | null)[]>([])
  const measured = useRef(false)
  const [viewportH, setViewportH] = useState<number | undefined>(undefined)
  const [trackY, setTrackY] = useState(0)
  const [animate, setAnimate] = useState(false)
  // Until the first question is measured, only the active one is mounted, so
  // the card opens at its real height instead of flashing to the height of
  // every question stacked and then shrinking.
  const [ready, setReady] = useState(false)

  const last = at === questions.length - 1
  const selected = answers[at] ?? []
  const hasAnswer = selected.length > 0 || Boolean(custom[at]?.trim())

  /**
   * The card follows the active question's own box. An observer rather than a
   * dependency list, because the question resizes for reasons the card cannot
   * enumerate: a wrapped option label, a typed custom answer, a font landing.
   */
  useLayoutEffect(() => {
    const item = questionRefs.current[at]
    if (!item) return

    const measure = () => {
      setViewportH(item.offsetHeight)
      setTrackY(item.offsetTop)
    }
    measure()
    setAnimate(measured.current && !prefersReducedMotion())
    measured.current = true
    setReady(true)

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(item)
    return () => observer.disconnect()
  }, [at])

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    },
    [],
  )

  const goTo = (next: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    setAt(Math.min(Math.max(next, 0), questions.length - 1))
  }

  const send = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    setSent(true)
    onSubmitted(answers)
  }

  const advance = () => {
    if (last) send()
    else goTo(at + 1)
  }

  const toggle = (index: number) => {
    const kind = questions[at]?.type
    setAnswers((current) => {
      const picked = current[at] ?? []
      const next =
        kind === 'radio'
          ? [index]
          : picked.includes(index)
            ? picked.filter((item) => item !== index)
            : [...picked, index]
      return { ...current, [at]: next }
    })
    if (kind !== 'radio') return

    setCustom((current) => ({ ...current, [at]: '' }))
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      if (last) send()
      else setAt((current) => Math.min(questions.length - 1, current + 1))
    }, AUTO_ADVANCE_MS)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-control bg-surface px-3 py-2 font-medium text-[12.5px] text-ink shadow-btn transition-colors duration-150 hover:bg-hover"
      >
        Open approval
      </button>
    )
  }

  if (sent) return <AnswersSent message={labels.sentMessage} />

  return (
    <div className="w-full max-w-80">
      <div
        className="relative overflow-hidden rounded-card bg-surface shadow-card"
        style={{ animation: 'fade-up 380ms cubic-bezier(0.23,1,0.32,1) both' }}
      >
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setOpen(false)}
          className="primitive-icon-button absolute top-2.5 right-2.5 z-10 text-ink-3 transition-colors duration-100 hover:bg-hover hover:text-ink"
        >
          <Ico
            size={14}
            stroke={2.2}
            path={<path d="M18 6L6 18M6 6l12 12" />}
          />
        </button>
        <div className="primitive-card-pad">
          <div
            className="overflow-hidden"
            style={{
              height: viewportH,
              transition: animate ? `height ${SLIDE}` : undefined,
            }}
            aria-live="polite"
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 26,
                transform: `translate3d(0, ${-trackY}px, 0)`,
                transition: animate ? `transform ${SLIDE}` : undefined,
                willChange: 'transform',
              }}
            >
              {questions.map((question, index) => (
                <ApprovalQuestionRow
                  key={question.q}
                  question={question}
                  active={index === at}
                  mounted={ready || index === at}
                  animate={animate}
                  picked={answers[index] ?? []}
                  custom={custom[index] ?? ''}
                  onPick={(optionIndex) => toggle(optionIndex)}
                  onCustomChange={(next) => {
                    setCustom((current) => ({ ...current, [index]: next }))
                    if (question.type === 'radio') {
                      setAnswers((current) => ({ ...current, [index]: [] }))
                    }
                  }}
                  onConfirm={() => {
                    if (hasAnswer) advance()
                  }}
                  itemRef={(el) => {
                    questionRefs.current[index] = el
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="primitive-card-footer flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-ink-3">
            <button
              type="button"
              aria-label="Previous question"
              disabled={at <= 0}
              onClick={() => goTo(at - 1)}
              className="flex size-[18px] items-center justify-center rounded-[5px] transition-colors duration-100 enabled:hover:text-ink disabled:opacity-30"
            >
              <Ico size={14} path={<path d="M18 15l-6-6-6 6" />} />
            </button>
            <span
              className="inline-flex items-center font-medium text-[12px] text-ink-3 tabular-nums"
              style={{ letterSpacing: '-0.1px', lineHeight: 1 }}
            >
              <RollingDigits value={`${at + 1} / ${questions.length}`} />
            </span>
            <button
              type="button"
              aria-label="Next question"
              disabled={last}
              onClick={() => goTo(at + 1)}
              className="flex size-[18px] items-center justify-center rounded-[5px] transition-colors duration-100 enabled:hover:text-ink disabled:opacity-30"
            >
              <Ico size={14} path={<path d="M6 9l6 6 6-6" />} />
            </button>
          </div>

          <div className="-mr-0.5 flex items-center gap-1.5">
            <Button
              variant="soft"
              size="sm"
              onClick={() => (last ? setOpen(false) : goTo(at + 1))}
            >
              Skip
            </Button>
            <Button
              variant="accent"
              size="sm"
              disabled={!hasAnswer}
              onClick={advance}
            >
              {last ? labels.send : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
