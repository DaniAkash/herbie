import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface ContextChunk {
  title: string
  chars: string
  body: string
  source: string
  badge: string
  /** A background utility class, one per card, cycled by the caller. */
  tone: string
}

/** The source chips arrive after the cards have landed, not with them. */
const CHIPS_DELAY_MS = 700

/** The retrieved passages an agent read, as a stack of cards. */
export function ContextCards({
  header,
  count,
  chunks,
  className,
}: {
  header: string
  count: string
  chunks: ContextChunk[]
  className?: string
}) {
  const [chipsShown, setChipsShown] = useState(false)

  useEffect(() => {
    const chips = setTimeout(() => setChipsShown(true), CHIPS_DELAY_MS)
    return () => clearTimeout(chips)
  }, [])

  return (
    <div className={cn('flex w-full max-w-95 flex-col gap-2', className)}>
      <div
        className="flex items-center gap-2 px-0.5"
        style={{ animation: 'fade-in 400ms ease-out both' }}
      >
        <span className="font-semibold text-[13px] text-ink">{header}</span>
        <span className="inline-flex h-5 items-center rounded-md bg-inset px-1.5 font-medium text-[11.5px] text-ink-2 tabular-nums shadow-hairline">
          {count}
        </span>
      </div>

      {chunks.map((chunk, i) => (
        <div
          key={chunk.title}
          className="overflow-hidden rounded-card bg-surface shadow-card"
          style={{
            animation: `fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${i * 100}ms both`,
          }}
        >
          <div className="primitive-card-bar flex items-center gap-2.5 border-line border-b">
            <span className="flex min-w-0 items-center gap-1.5 font-medium text-[13px] text-ink">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              <span className="truncate">{chunk.title}</span>
            </span>
            <span className="ml-auto shrink-0 text-[12px] text-ink-3 tabular-nums">
              {chunk.chars}
            </span>
          </div>
          <p className="px-3 pt-2 pb-1 text-[12.5px] text-ink-2 leading-relaxed">
            {chunk.body}
          </p>
          <div className="px-3 pb-3">
            <span
              className="inline-flex h-6 items-center gap-1.5 rounded-full bg-inset px-2 font-medium text-[12px] text-ink-2 shadow-btn transition-[opacity,transform,background-color] duration-300 hover:bg-hover"
              style={{
                opacity: chipsShown ? 1 : 0,
                transform: chipsShown ? 'scale(1)' : 'scale(0.95)',
                transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
                transitionDelay: `${i * 80}ms`,
              }}
            >
              <span
                className={cn(
                  'flex size-3.5 items-center justify-center rounded-[4px] font-bold text-[7px] text-white',
                  chunk.tone,
                )}
              >
                {chunk.badge}
              </span>
              {chunk.source}
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
