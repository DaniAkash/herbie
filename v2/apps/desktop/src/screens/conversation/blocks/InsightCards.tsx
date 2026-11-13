import { type ComponentType, type ReactNode, useState } from 'react'

export interface InsightPage {
  key: string
  prose: ReactNode
  Card: ComponentType
  pill: string
}

/** One insight at a time, with a pager over however many there are. */
export function InsightCards({
  title,
  pages,
}: {
  title: string
  pages: InsightPage[]
}) {
  const [at, setAt] = useState(0)
  const current = pages[at]
  if (!current) return null

  const move = (direction: -1 | 1) =>
    setAt((page) => (page + direction + pages.length) % pages.length)

  return (
    <div className="w-full max-w-[560px]">
      <div className="flex items-center justify-between">
        <span className="flex items-baseline gap-1.5">
          <span className="font-semibold text-[13px] text-ink">{title}</span>
          <span className="text-[13px] text-ink-3 tabular-nums">
            {pages.length}
          </span>
        </span>
        <span className="flex items-center gap-0.5">
          <PagerButton label="Previous insight" onClick={() => move(-1)}>
            M15 18l-6-6 6-6
          </PagerButton>
          <PagerButton label="Next insight" onClick={() => move(1)}>
            M9 6l6 6-6 6
          </PagerButton>
        </span>
      </div>

      <p className="mt-1.5 text-[12.5px] text-ink-2 leading-relaxed">
        {current.prose}
      </p>
      <div className="mt-2">
        <current.Card />
      </div>
      <button
        type="button"
        className="mt-2 rounded-full bg-surface px-3 py-1.5 text-left text-[12px] text-ink shadow-btn transition-colors duration-100 hover:bg-hover"
      >
        {current.pill}
      </button>
    </div>
  )
}

function PagerButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  /** The chevron's path data. */
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 transition-[background-color,color,transform] duration-100 hover:bg-hover hover:text-ink active:scale-[0.96]"
    >
      <svg
        aria-hidden="true"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={children} />
      </svg>
    </button>
  )
}
