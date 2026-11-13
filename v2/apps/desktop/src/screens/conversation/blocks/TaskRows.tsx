import { useState } from 'react'
import { cn } from '@/lib/utils'

/** One detail line shown when a task row is expanded. */
export interface TaskDetail {
  label: string
  meta: string
}

export interface TaskRow {
  key: string
  label: string
  amount: string
  status: 'done' | 'running'
  details: TaskDetail[]
}

/** The state of several pieces of work, each able to show its own detail. */
export function TaskRows({
  rows,
  className,
}: {
  rows: TaskRow[]
  className?: string
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  return (
    <div
      className={cn(
        'flex min-h-[196px] w-full max-w-110 flex-col gap-2',
        className,
      )}
    >
      {rows.map((row, i) => (
        <Row
          key={row.key}
          row={row}
          index={i}
          open={open[row.key] ?? false}
          onToggle={() =>
            setOpen((current) => ({
              ...current,
              [row.key]: !(current[row.key] ?? false),
            }))
          }
        />
      ))}
    </div>
  )
}

function Row({
  row,
  index,
  open,
  onToggle,
}: {
  row: TaskRow
  index: number
  open: boolean
  onToggle: () => void
}) {
  const done = row.status === 'done'

  return (
    <div
      className="self-stretch overflow-hidden bg-surface shadow-card transition-[border-radius,background-color] duration-300 hover:bg-inset"
      style={{
        // Tightens as it opens, so the detail reads as part of the same card.
        borderRadius: open ? 14 : 22,
        animation: `fade-up 450ms cubic-bezier(0.23,1,0.32,1) ${index * 80}ms both`,
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-11 w-full items-center gap-2.5 px-2.5 text-left"
      >
        <span className="flex size-6 shrink-0 items-center justify-center">
          {done ? <DoneBadge /> : <SpinnerRing />}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-[13px] text-ink">
          {row.label}
        </span>
        <span className="text-[12.5px] text-ink-2 tabular-nums">
          {row.amount}
        </span>
        {done ? (
          <span className="inline-flex h-5.5 items-center rounded-full bg-green-tint px-2 font-medium text-[11.5px] text-green">
            Completed
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className="-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3"
        >
          <svg
            aria-hidden="true"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-300"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      <Details details={row.details} open={open} />
    </div>
  )
}

/**
 * The detail drop-down, on a 0fr to 1fr grid row so the panel measures its own
 * height and a fixed one never has to be guessed.
 */
function Details({ details, open }: { details: TaskDetail[]; open: boolean }) {
  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300"
      style={{
        gridTemplateRows: open ? '1fr' : '0fr',
        opacity: open ? 1 : 0,
        transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
      }}
    >
      <div className="overflow-hidden">
        <div className="mb-2.5 grid grid-cols-[24px_1fr] gap-2.5 px-2.5">
          <span aria-hidden="true" className="mx-auto h-full w-px bg-line" />
          <div className="flex flex-col gap-1.5">
            {details.map((detail, j) => (
              <div
                key={detail.label}
                className="flex items-center justify-between"
                style={
                  open
                    ? {
                        animation: `fade-up 300ms cubic-bezier(0.23,1,0.32,1) ${120 + j * 100}ms both`,
                      }
                    : undefined
                }
              >
                <span className="text-[12px] text-ink-2">{detail.label}</span>
                <span className="font-mono text-[11.5px] text-ink-3 tabular-nums">
                  {detail.meta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const RING_SIZE = 24
const RING_STROKE = 2

function SpinnerRing() {
  const r = (RING_SIZE - RING_STROKE) / 2
  const circumference = 2 * Math.PI * r

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg
        aria-hidden="true"
        width={RING_SIZE}
        height={RING_SIZE}
        className="absolute inset-0"
        style={{ animation: 'spin 1.1s linear infinite' }}
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.28} ${circumference * 0.72}`}
        />
      </svg>
    </span>
  )
}

function DoneBadge() {
  return (
    <span
      className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-green text-white"
      style={{ animation: 'pop-in 300ms cubic-bezier(0.23,1,0.32,1) both' }}
    >
      <svg
        aria-hidden="true"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  )
}
