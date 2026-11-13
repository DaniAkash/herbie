import type { VariantProps } from 'class-variance-authority'
import { type ReactNode, useState } from 'react'
import { Button, type buttonVariants } from '@/components/ui/button'

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>

export interface RecommendationOption {
  key: string
  body: ReactNode
  short: string
  /** How many of the three meter bars are lit. */
  signal: number
  /** The meter's colour, as a CSS value. */
  tone: string
  label: string
  cta: string
  ctaVariant: ButtonVariant
}

export interface RecommendationLabels {
  title: string
  alternatives: string
  otherOptions: string
  accepted: string
}

/**
 * A decision with a default and alternatives.
 *
 * The card holds its shape. Opening the alternatives adds a section rather
 * than replacing one, and picking from it promotes that option to the
 * recommendation.
 */
export function RecommendationCard({
  options,
  labels,
}: {
  options: RecommendationOption[]
  labels: RecommendationLabels
}) {
  const [selected, setSelected] = useState(0)
  const [open, setOpen] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const active = options[selected]
  if (!active) return null

  return (
    <div className="w-full max-w-95 overflow-hidden rounded-card bg-surface shadow-card">
      <div className="primitive-card-pad">
        <span className="font-medium text-[14px] text-ink">{labels.title}</span>
        <p
          key={active.key}
          className="mt-1.5 min-h-12 text-[13px] text-ink-2 leading-relaxed"
          style={{ animation: 'fade-in 180ms ease-out both' }}
        >
          {active.body}
        </p>
      </div>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="overflow-hidden">
          <div className="border-line border-t bg-surface px-2 py-2">
            <p className="px-1.5 pb-1 font-medium text-[11px] text-ink-3">
              {labels.otherOptions}
            </p>
            {options.map((option, at) =>
              at === selected ? null : (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setSelected(at)
                    setAccepted(false)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-control px-1.5 py-1.5 text-left transition-colors duration-100 hover:bg-hover"
                >
                  <Meter signal={option.signal} tone={option.tone} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                    {option.short}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-3">
                    {option.label}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="primitive-card-footer flex items-center justify-between gap-3 bg-surface">
        <span className="flex items-center gap-2">
          <Meter signal={active.signal} tone={active.tone} />
          <span className="font-medium text-[12.5px] text-ink-2">
            {active.label}
          </span>
        </span>

        <span className="-mr-0.5 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="px-2.5 text-[12.5px]"
          >
            {labels.alternatives}
          </Button>
          <Button
            variant={accepted ? 'success' : active.ctaVariant}
            size="sm"
            onClick={() => setAccepted(true)}
            className="text-[12.5px]"
          >
            {accepted ? labels.accepted : active.cta}
          </Button>
        </span>
      </div>
    </div>
  )
}

/** Confidence as three bars, lit from the left. */
function Meter({ signal, tone }: { signal: number; tone: string }) {
  return (
    <span className="flex items-end gap-0.5">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="w-1 rounded-full transition-colors duration-300"
          style={{
            height: 10,
            background: bar < signal ? tone : 'var(--line-strong)',
          }}
        />
      ))}
    </span>
  )
}
