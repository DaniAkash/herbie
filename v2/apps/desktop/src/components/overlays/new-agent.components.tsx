import { Radio as RadioPrimitive } from '@animate-ui/react/primitives/base-ui/radio'
import { Check, ChevronLeft } from 'lucide-react'
import {
  arc,
  LayoutGroup,
  motion,
  type Transition,
  useReducedMotion,
} from 'motion/react'
import { useId } from 'react'
import { RadioGroup } from '@/components/ui/radio-group'
import { SPRING_LAYOUT, SPRING_PRESS } from '@/lib/ease'
import { cn } from '@/lib/utils'

/**
 * The selection ring hops to the next swatch over a low arc instead of
 * sliding. A negative strength puts the bulge above a horizontal row in both
 * directions of travel.
 */
const SELECTION_HOP: Transition = {
  ...SPRING_LAYOUT,
  layout: { ...SPRING_LAYOUT, path: arc({ strength: -0.2 }) },
}

export interface ColorSwatch {
  value: string
  /** Any CSS colour, including a custom property. */
  color: string
  /** Accessible name, so the choice never rests on colour alone. */
  label: string
}

/**
 * A row of colour swatches, one of which is chosen.
 *
 * The radio semantics come from the shared radio group; the swatch itself is
 * drawn here because no component library ships one.
 */
export function ColorSwatches({
  swatches,
  value,
  onValueChange,
  label,
}: {
  swatches: readonly ColorSwatch[]
  value: string
  onValueChange: (value: string) => void
  label: string
}) {
  const reduce = useReducedMotion()
  const group = useId()

  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      className="flex w-full flex-wrap items-center gap-3 p-1"
    >
      <LayoutGroup id={group}>
        {swatches.map((swatch) => (
          <motion.span
            key={swatch.value}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            transition={SPRING_PRESS}
            className="relative inline-flex shrink-0 rounded-full"
          >
            <RadioPrimitive.Root
              value={swatch.value}
              aria-label={swatch.label}
              className="relative flex size-11 cursor-pointer items-center justify-center rounded-full border border-ink/10 bg-hover/60 outline-none focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-4"
            >
              {value === swatch.value ? (
                <motion.span
                  layoutId={reduce ? undefined : 'color-selection'}
                  initial={false}
                  transition={SELECTION_HOP}
                  className="pointer-events-none absolute -inset-1 rounded-full border-2"
                  style={{
                    borderColor: `color-mix(in srgb, ${swatch.color} 65%, transparent)`,
                  }}
                />
              ) : null}
              <span
                className="size-5 rounded-full border border-black/5"
                style={{ backgroundColor: swatch.color }}
              />
            </RadioPrimitive.Root>
          </motion.span>
        ))}
      </LayoutGroup>
    </RadioGroup>
  )
}

/**
 * Which of the two steps you are on, and what the first one decided.
 *
 * `current` is the step, not a guess at it. Reading it off the name meant the
 * header stayed on step one whenever the second step was reached with the
 * name still empty, which is what a url pointing straight at it does.
 */
export function Steps({ current, name }: { current: 1 | 2; name?: string }) {
  const onSecond = current === 2
  return (
    <div className="mb-4 flex items-center gap-2 text-[12.5px]">
      <Step n="1" current={!onSecond} done={onSecond}>
        {name?.trim() || 'Who it is'}
      </Step>
      <span className="h-px flex-1 bg-line" />
      <Step n="2" current={onSecond}>
        How it runs
      </Step>
    </div>
  )
}

function Step({
  n,
  current,
  done = false,
  children,
}: {
  n: string
  current: boolean
  done?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      aria-current={current ? 'step' : undefined}
      className={cn(
        'flex min-w-0 items-center gap-1.5',
        current ? 'font-medium text-ink' : 'text-ink-3',
      )}
    >
      <span
        className={cn(
          'grid size-[17px] shrink-0 place-items-center rounded-full text-[10.5px] leading-none',
          current || done ? 'bg-ink text-canvas' : 'bg-hover-2 text-ink-3',
        )}
      >
        {done ? <Check size={9} strokeWidth={3} /> : n}
      </span>
      <span className="truncate">{children}</span>
    </span>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="-ml-1 inline-flex size-7 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink"
    >
      <ChevronLeft size={16} />
    </button>
  )
}
