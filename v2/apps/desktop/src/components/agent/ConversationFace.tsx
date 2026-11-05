import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { AgentFace } from '@/components/agent/AgentFace'
import type { Agent } from '@/modules/api/agents.hooks'

// The supplied directional gestures each take 4.8 seconds to settle.
const GESTURES = [
  'gentle-nod',
  'look-right',
  'look-up',
  'look-left',
  'look-down',
  'delighted',
  'surprised',
  'idle',
] as const

export function ConversationFace({
  agent,
  selected,
  hovered,
}: {
  agent: Agent
  selected: boolean
  hovered: boolean
}) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const playing = selected && !hovered && agent.state === 'idle' && !reduce

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(
      () => setStep((n) => (n + 1) % GESTURES.length),
      4800,
    )
    return () => window.clearInterval(timer)
  }, [playing])

  const state = faceState(agent.state, hovered, playing, step)

  return (
    <AgentFace
      color={agent.color}
      shape={agent.shape}
      size="xl"
      animate={
        agent.state === 'working' ||
        agent.state === 'stuck' ||
        selected ||
        hovered
      }
      state={state}
      off={agent.state === 'off'}
    />
  )
}

function faceState(
  state: string,
  hovered: boolean,
  playing: boolean,
  step: number,
) {
  if (state === 'working') return 'thinking'
  if (state === 'stuck') return 'error'
  if (state === 'off') return 'idle'
  if (playing) return GESTURES[step] ?? 'idle'
  return hovered ? 'delighted' : 'idle'
}
