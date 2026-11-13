import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Variants:
 *   Drive   square cells, chevron wavefront driving right. The 650ms cycle is
 *           shorter than the sweep, so two fronts are always in flight.
 *   Orbit   a comet lapping the grid perimeter.
 *   Surfer  the Drive loader paired with a looping clip, for a long wait.
 *
 * Reduced motion freezes the grid to its dim state and the timer still ticks,
 * which is handled by the keyframes rather than here.
 */
export type LoadingVariant = 'Drive' | 'Orbit' | 'Surfer'

/**
 * Hosted rather than bundled so it plays in production; the local copy at
 * public/subway-surfers.mp4 is gitignored. Heavily compressed, at 288px and
 * 20fps with no audio, to keep the data transfer down.
 */
const SURFER_VIDEO =
  'https://95dnc2a95qgwt9ff.public.blob.vercel-storage.com/subway-surfers-min.mp4'

interface Cell {
  /** Row and column, which is the only identity a grid cell has. */
  at: string
  /** Milliseconds into the cycle, or null for a cell the front never reaches. */
  delay: number | null
}

/** Nine cells in reading order, with `at` naming each one's place. */
function cells(delayAt: (index: number) => number | null): Cell[] {
  return Array.from({ length: 9 }, (_, i) => ({
    at: `r${Math.floor(i / 3)}c${i % 3}`,
    delay: delayAt(i),
  }))
}

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3]

interface Pattern {
  cells: Cell[]
  dur: number
  round: boolean
}

const PATTERNS: Record<'Drive' | 'Orbit', Pattern> = {
  Drive: {
    cells: cells((i) => (Math.abs(Math.floor(i / 3) - 1) + (i % 3)) * 90),
    dur: 650,
    round: false,
  },
  Orbit: {
    cells: cells((i) => {
      const k = ORBIT_ORDER.indexOf(i)
      return k === -1 ? null : k * 110
    }),
    dur: 950,
    round: false,
  },
}

export function LoadingState({
  label,
  variant = 'Drive',
}: {
  label?: string
  variant?: LoadingVariant
}) {
  const elapsed = useElapsed()
  const surfer = variant === 'Surfer'
  const pattern = surfer ? PATTERNS.Drive : PATTERNS[variant]

  const status = (
    <div className="flex items-center gap-2.5">
      <LoaderGrid {...pattern} />
      <span
        className="bg-clip-text font-medium text-[13px] text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(90deg, var(--ink-3) 35%, var(--ink) 50%, var(--ink-3) 65%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer-text 1.4s linear infinite',
        }}
      >
        {label ?? (surfer ? 'Subway surfing' : 'Churning')}
      </span>
      <span className="font-mono text-[12px] text-ink-3 tabular-nums">
        {elapsed}
      </span>
    </div>
  )

  if (!surfer) {
    return (
      <div role="status" className="flex w-fit items-center gap-2.5">
        {status}
      </div>
    )
  }

  return (
    <div role="status" className="flex w-fit flex-col items-start">
      {status}
      <SurferCard />
    </div>
  )
}

function LoaderGrid({ cells: grid, dur, round }: Pattern) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]"
    >
      {grid.map((cell) => (
        <span
          key={cell.at}
          className={cn(
            'size-[4px] bg-ink',
            round ? 'rounded-full' : 'rounded-[1px]',
          )}
          style={{
            opacity: cell.delay === null ? 0.07 : 0.15,
            animation:
              cell.delay === null
                ? 'none'
                : `pixel-on ${dur}ms ease-in-out ${cell.delay}ms infinite`,
          }}
        />
      ))}
    </span>
  )
}

/** The card follows the status text it is illustrating. */
function SurferCard() {
  const [videoOk, setVideoOk] = useState(true)

  return (
    <div
      className="mt-2 w-56 overflow-hidden rounded-[10px] shadow-overlay"
      style={{
        animation: 'pop-in 200ms cubic-bezier(0.16,1,0.3,1) both',
        transformOrigin: 'top left',
      }}
    >
      <div
        className="relative aspect-video w-full"
        style={{ background: 'var(--tooltip-bg)' }}
      >
        {videoOk ? (
          <video
            src={SURFER_VIDEO}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoOk(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
            <LoaderGrid {...PATTERNS.Drive} />
            <span
              className="px-3 text-center font-mono text-[10px]"
              style={{ color: 'var(--tooltip-muted)' }}
            >
              Video unavailable
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Tenths of a second since mount, as a readable duration. */
function useElapsed() {
  const [ds, setDs] = useState(0)

  useEffect(() => {
    const tick = setInterval(() => setDs((d) => d + 1), 100)
    return () => clearInterval(tick)
  }, [])

  const total = ds / 10
  if (total < 60) return `${total.toFixed(1)}s`
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`
}
