import { type ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const ROLL_MS = 400

/** One character of the counter, mid-roll. */
interface Roll {
  key: string
  top: string
  bottom: string
  restY: string
  startY: string
}

/**
 * The step counter, rolling like an odometer.
 *
 * Only the characters that changed roll; the rest are rendered as plain text
 * so a stable "/" or a two-digit total does not twitch beside the digit that
 * moved.
 */
export function RollingDigits({ value }: { value: string }) {
  const previous = useRef(value)
  const [from, setFrom] = useState(value)
  const [to, setTo] = useState(value)
  const [rolling, setRolling] = useState(false)
  const [shifted, setShifted] = useState(false)
  const [down, setDown] = useState(false)

  useEffect(() => {
    if (previous.current === value) return
    const was = previous.current
    previous.current = value
    const wasN = Number.parseInt(was, 10)
    const nowN = Number.parseInt(value, 10)
    setDown(Number.isFinite(wasN) && Number.isFinite(nowN) && nowN < wasN)
    setFrom(was)
    setTo(value)
    setRolling(true)
    setShifted(false)

    // Two frames: the first mounts both characters at the starting offset, the
    // second moves them, so the browser has something to transition from.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShifted(true))
    })
    const done = setTimeout(() => {
      setRolling(false)
      setFrom(value)
      setShifted(false)
    }, ROLL_MS)

    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
      clearTimeout(done)
    }
  }, [value])

  const chars = rolling ? to : from
  const cells = Array.from({ length: chars.length }, (_, i) => {
    const was = from[i] ?? ''
    const now = chars[i] ?? ''
    if (!rolling || was === now) return { key: `${i}-${now}`, now }
    return {
      key: `${i}-${was}-${now}-${down ? 'down' : 'up'}`,
      now,
      roll: {
        top: down ? now : was,
        bottom: down ? was : now,
        restY: down ? '0' : '-1em',
        startY: down ? '-1em' : '0',
      },
    }
  })

  return (
    <>
      {cells.map((cell) =>
        'roll' in cell && cell.roll ? (
          <RollingChar key={cell.key} roll={cell.roll} shifted={shifted} />
        ) : (
          <span key={cell.key}>{cell.now}</span>
        ),
      )}
    </>
  )
}

function RollingChar({
  roll,
  shifted,
}: {
  roll: Omit<Roll, 'key'>
  shifted: boolean
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
        height: '1em',
        lineHeight: '1em',
        verticalAlign: '-0.05em',
      }}
    >
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)',
          transform: `translateY(${shifted ? roll.restY : roll.startY})`,
        }}
      >
        <span style={{ height: '1em', lineHeight: '1em' }}>{roll.top}</span>
        <span style={{ height: '1em', lineHeight: '1em' }}>{roll.bottom}</span>
      </span>
    </span>
  )
}

export function Ico({
  path,
  size = 14,
  stroke = 2,
}: {
  path: ReactNode
  size?: number
  stroke?: number
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  )
}

/** The radio dot or the checkbox tick, filled once the option is picked. */
export function OptionMark({
  kind,
  on,
}: {
  kind: 'radio' | 'check'
  on: boolean
}) {
  return (
    <span
      className={cn(
        'flex size-4 shrink-0 items-center justify-center transition-colors duration-200',
        kind === 'radio' ? 'rounded-full' : 'rounded-[5px]',
        on
          ? 'bg-ink text-canvas'
          : 'text-transparent shadow-[inset_0_0_0_1.5px_var(--line-strong)]',
      )}
    >
      {kind === 'radio' ? (
        <span
          className="size-1.5 rounded-full bg-canvas transition-transform duration-200"
          style={{ transform: on ? 'scale(1)' : 'scale(0)' }}
        />
      ) : (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  )
}

/** The confirmation that replaces the card once the answers have gone. */
export function AnswersSent({ message }: { message: string }) {
  return (
    <div
      className="flex w-full max-w-80 items-center gap-3"
      style={{ animation: 'pop-in 260ms cubic-bezier(0.23,1,0.32,1) both' }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-tint py-1 pr-2.5 pl-1 font-medium text-[12.5px] text-green">
        <span className="flex size-4.5 items-center justify-center rounded-full bg-green text-white">
          <svg
            aria-hidden="true"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        {message}
      </span>
    </div>
  )
}
