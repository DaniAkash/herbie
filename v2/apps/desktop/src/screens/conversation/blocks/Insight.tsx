import type { InsightBoard, TranscriptRecord } from '@bun/shared/transcript'
import InsightCards from '@/components/primitives/InsightCards'
import {
  AllocationChart,
  AnomalyChart,
  CompareChart,
} from '@/screens/conversation/blocks/insight.charts'

type Insight = Extract<TranscriptRecord, { kind: 'show_insight' }>

/**
 * A `show_insight` block: numbers, with a sentence of reading.
 *
 * The card shell, its carousel and its pagination come from beautifui. The
 * plots do not, and cannot: `pages[].Card` is a `React.ComponentType`, so a
 * page's chart is code rather than data and an agent cannot send one. Each
 * page's `kind` picks one of three plots Herbie owns, which is why the tool's
 * schema closes that set rather than promising any chart.
 */
const PLOTS = {
  compare: CompareChart,
  anomaly: AnomalyChart,
  allocation: AllocationChart,
} as const

const PILLS: Record<InsightBoard['kind'], string> = {
  compare: 'Compare',
  anomaly: 'Outlier',
  allocation: 'Split',
}

export function Insight({ record }: { record: Insight }) {
  return (
    <InsightCards
      labels={{ title: record.title }}
      pages={record.pages.map((page, at) => {
        const Plot = PLOTS[page.kind]
        return {
          key: `${at}-${page.heading}`,
          prose: (
            <>
              <span className="font-medium text-ink">{page.heading}</span>{' '}
              {page.prose}
            </>
          ),
          // A closure rather than the plot itself, because the component
          // renders `Card` with no props and the data has to come from here.
          Card: () => <Plot series={page.series} />,
          pill: PILLS[page.kind],
        }
      })}
    />
  )
}
