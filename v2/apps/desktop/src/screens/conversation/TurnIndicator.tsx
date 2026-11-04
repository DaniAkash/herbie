import { useEffect, useState } from 'react'
import LoadingState from '@/components/primitives/LoadingState'
import type { Phase } from '@/screens/conversation/conversation.reducer'

/**
 * What the agent is doing, while it is doing it.
 *
 * Mounted once per turn and never remounted, because `LoadingState` starts
 * its elapsed clock at mount and keeps it above the variant switch. Changing
 * only `variant` keeps one continuous timer, which is exactly what the brief
 * asks for; rendering a second one would restart the clock at every stage.
 *
 * ```text
 * thinking   Drive     the agent has the message and has not acted yet
 * working    Orbit     a tool call or a token has arrived
 * past 60s   Surfer    it is taking a while, and says so
 * waiting              nothing: the agent is stopped on the person, and a
 *                      spinner next to a question it is waiting on would be
 *                      the app pretending to work
 * ```
 */

/** When the third stage begins, from the brief. */
const LONG_MS = 60_000

/**
 * The video for the Surfer card, local rather than the component's default.
 *
 * Upstream points at a Vercel Blob URL, which would mean a desktop app
 * reaching the network to draw a loading state. This is a placeholder: swap
 * the file, keep the path.
 */
const WORKING_VIDEO = '/working.mp4'

export function TurnIndicator({
  phase,
  activity,
  startedAt,
}: {
  phase: Phase
  activity: string
  startedAt: number | null
}) {
  const long = usePastLong(startedAt)

  if (phase === 'idle' || phase === 'waiting' || startedAt === null) return null

  const variant = long ? 'Surfer' : phase === 'working' ? 'Orbit' : 'Drive'
  return (
    <LoadingState
      variant={variant}
      videoSrc={WORKING_VIDEO}
      label={activity || (phase === 'working' ? 'Working' : 'Thinking')}
    />
  )
}

/**
 * Whether this turn has passed the minute mark.
 *
 * A timer rather than a render-time comparison, because nothing else would
 * re-render the indicator at the moment it crosses. One timeout per turn,
 * not an interval: the only thing anyone needs to know is whether the line
 * has been crossed, and the component draws its own seconds.
 */
function usePastLong(startedAt: number | null): boolean {
  const [long, setLong] = useState(false)

  useEffect(() => {
    if (startedAt === null) {
      setLong(false)
      return
    }
    const remaining = startedAt + LONG_MS - Date.now()
    if (remaining <= 0) {
      setLong(true)
      return
    }
    setLong(false)
    const timer = setTimeout(() => setLong(true), remaining)
    return () => clearTimeout(timer)
  }, [startedAt])

  return long
}
