import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { approxTokensFromChars, formatTokenCount } from './agent-busy.tokens'
import { AGENT_BUSY_VERBS } from './agent-busy.verbs'

const VERB_ROTATE_MS = 10_000
const ELAPSED_TICK_MS = 1_000

interface AgentBusyProps {
  // True for the lifetime of the in-flight assistant turn; flips false
  // on turn.finish / cancel / error. Single source of truth for whether
  // the indicator renders.
  isStreaming: boolean
  // ms epoch from the turn.start event — anchors the elapsed cell.
  // Use 0 (or omit via undefined) when no turn is active; the elapsed
  // tick stays at 0 in that case but the component returns null anyway.
  startedAt: number
  // Sum of stream text + reasoning delta lengths so far. Estimated as
  // tokens for the output cell.
  outputChars: number
  // Optional input-char estimate; undefined until meta.turn-input
  // arrives (a routeTurn-duration after turn.start). Render hides the
  // input cell when missing rather than showing a placeholder so the
  // row doesn't jitter.
  inputChars?: number
}

function pickVerb(): string {
  return AGENT_BUSY_VERBS[
    Math.floor(Math.random() * AGENT_BUSY_VERBS.length)
  ] as string
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${String(rem).padStart(2, '0')}s`
}

export function AgentBusy({
  isStreaming,
  startedAt,
  outputChars,
  inputChars,
}: AgentBusyProps) {
  const [verb, setVerb] = useState(pickVerb)
  const [elapsed, setElapsed] = useState(0)

  // Fresh verb every time streaming starts so back-to-back turns don't
  // always open on the same word.
  useEffect(() => {
    if (isStreaming) setVerb(pickVerb())
  }, [isStreaming])

  useEffect(() => {
    if (!isStreaming) return
    const id = setInterval(() => setVerb(pickVerb()), VERB_ROTATE_MS)
    return () => clearInterval(id)
  }, [isStreaming])

  useEffect(() => {
    if (!isStreaming || !startedAt) {
      setElapsed(0)
      return
    }
    setElapsed(Date.now() - startedAt)
    const id = setInterval(
      () => setElapsed(Date.now() - startedAt),
      ELAPSED_TICK_MS,
    )
    return () => clearInterval(id)
  }, [isStreaming, startedAt])

  if (!isStreaming) return null

  const outTokens = approxTokensFromChars(outputChars)
  const inTokens =
    typeof inputChars === 'number' ? approxTokensFromChars(inputChars) : null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Agent is ${verb.toLowerCase()}`}
      className="flex items-center gap-3 px-1 py-2 text-muted-foreground text-xs tabular-nums"
    >
      <Spinner className="size-3" />
      <span className="italic">{verb}…</span>
      <span className="font-mono">{formatElapsed(elapsed)}</span>
      <span className="text-muted-foreground/60">·</span>
      <span className="font-mono">↓ ~{formatTokenCount(outTokens)} tok</span>
      {inTokens !== null && (
        <>
          <span className="text-muted-foreground/60">·</span>
          <span className="font-mono">↑ ~{formatTokenCount(inTokens)} tok</span>
        </>
      )}
    </div>
  )
}
