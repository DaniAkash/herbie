import type { InsightBoard } from '@bun/shared/transcript'
import { Liveline, type LivelinePoint, type LivelineSeries } from 'liveline'
import { useDark } from '@/screens/conversation/blocks/insight.hooks'

/**
 * The three plots an `show_insight` block can draw.
 *
 * beautifui's `InsightCards` ships three of its own, but they are module
 * private and each takes a gallery-specific shape, so there is nothing to
 * hand data to. These are Herbie's, over the `{ label, value }` series the
 * tool accepts, using the same chart library the component itself depends on
 * where a line is the right mark and plain bars where it is not.
 *
 * This is the honest limit the plan promised to state: the agent can draw
 * three kinds of chart, not any chart, and the tool's schema says which.
 */

export type Series = InsightBoard['series']

/**
 * The chart's horizontal span, in seconds.
 *
 * `liveline` plots a live feed: a point's `time` is epoch seconds and
 * `window` is how many seconds back from now to draw. A categorical series
 * has no times, so it is laid out ending at now and spaced across this span.
 * Indices would land in 1970, outside any window, and the chart would show
 * its empty state rather than a line, which is exactly what it did.
 */
const SPAN_SECONDS = 42

/** Resolved by the canvas, so it cannot be a token. */
const LINE_COLOR = '#3d9aff'

/** Lays a categorical series out along the window, ending at now. */
function overLastSeconds(series: Series, span: number): LivelinePoint[] {
  const end = Math.floor(Date.now() / 1000)
  const gap = span / Math.max(series.length - 1, 1)
  return series.map((point, at) => ({
    time: end - Math.round((series.length - 1 - at) * gap),
    value: point.value,
  }))
}

function extent(series: Series): { min: number; max: number } {
  const values = series.map((point) => point.value)
  return { min: Math.min(0, ...values), max: Math.max(...values, 1) }
}

/** Several things side by side, which is a bar per label. */
export function CompareChart({ series }: { series: Series }) {
  const { max } = extent(series)
  return (
    <div className="grid gap-2 rounded-card bg-surface p-3 shadow-hairline">
      {series.map((point) => (
        <div key={point.label} className="grid gap-1">
          <span className="flex items-baseline gap-2 text-[11.5px] text-ink-2">
            <span className="truncate">{point.label}</span>
            <span className="ml-auto font-mono text-ink tabular-nums">
              {point.value.toLocaleString()}
            </span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-inset">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${Math.max((point.value / max) * 100, 1.5)}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * One series over time with its outlier called out.
 *
 * The outlier is found here rather than asked of the agent: it is a fact
 * about the numbers it already sent, and a tool argument the caller can get
 * wrong is worse than one it cannot.
 */
export function AnomalyChart({ series }: { series: Series }) {
  const dark = useDark()
  const peak = series.reduce(
    (worst, point) => (point.value > worst.value ? point : worst),
    series[0] ?? { label: '', value: 0 },
  )
  const rest = series.filter((point) => point !== peak)
  const average =
    rest.length > 0
      ? rest.reduce((sum, point) => sum + point.value, 0) / rest.length
      : 0

  const line: LivelineSeries[] = [
    {
      id: 'series',
      label: '',
      // A literal, not a token: the chart paints to a canvas, where a CSS
      // variable resolves to nothing and the line is drawn in transparent.
      color: LINE_COLOR,
      value: series.at(-1)?.value ?? 0,
      data: overLastSeconds(series, SPAN_SECONDS),
    },
  ]

  return (
    <div className="rounded-card bg-surface p-3 shadow-hairline">
      <span className="flex items-baseline gap-2">
        <span className="font-semibold text-[17px] text-ink tabular-nums">
          {peak.value.toLocaleString()}
        </span>
        <span className="text-[11.5px] text-ink-2">
          at {peak.label}
          {average > 0
            ? `, ${Math.round((peak.value / average - 1) * 100)}% above the rest`
            : ''}
        </span>
      </span>
      <div className="mt-2 h-[150px] overflow-hidden rounded-control bg-inset">
        <Liveline
          data={[]}
          value={0}
          series={line}
          theme={dark ? 'dark' : 'light'}
          grid={false}
          pulse={false}
          paused
          scrub={false}
          cursor="default"
          window={SPAN_SECONDS}
          lineWidth={2.25}
          padding={{ top: 16, right: 0, bottom: 16, left: 0 }}
        />
      </div>
    </div>
  )
}

const SLICES = [
  'var(--accent)',
  'var(--green)',
  'var(--orange)',
  'var(--blue)',
  'var(--red)',
] as const

/** Parts of a whole, as one stacked bar with a legend. */
export function AllocationChart({ series }: { series: Series }) {
  const total = series.reduce((sum, point) => sum + point.value, 0) || 1
  return (
    <div className="grid gap-2.5 rounded-card bg-surface p-3 shadow-hairline">
      <span className="flex h-3 overflow-hidden rounded-full bg-inset">
        {series.map((point, at) => (
          <span
            key={point.label}
            style={{
              width: `${(point.value / total) * 100}%`,
              background: SLICES[at % SLICES.length],
            }}
          />
        ))}
      </span>
      <div className="grid gap-1">
        {series.map((point, at) => (
          <span
            key={point.label}
            className="flex items-center gap-1.5 text-[11.5px] text-ink-2"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: SLICES[at % SLICES.length] }}
            />
            <span className="truncate">{point.label}</span>
            <span className="ml-auto font-mono text-ink tabular-nums">
              {Math.round((point.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
