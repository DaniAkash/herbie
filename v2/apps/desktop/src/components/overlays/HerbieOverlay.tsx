import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Switch } from '@/components/motion/switch'
import { Overlay } from '@/components/shell/Overlay'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import { useAgents } from '@/modules/api/agents.hooks'
import { closeOverlay } from '@/modules/navigation/overlay'

const RUNTIMES = [
  { id: 'claude', name: 'Claude Code' },
  { id: 'codex', name: 'Codex' },
  { id: 'gemini', name: 'Gemini' },
]

/**
 * App scope only.
 *
 * Signing a runtime in makes it available; which one an agent uses is picked
 * on that agent, because acpAgent is a column on the agent row.
 */
export function HerbieOverlay() {
  const { data } = useAgents()
  const [background, setBackground] = useState(true)
  const [atLogin, setAtLogin] = useState(true)

  const used = (id: string) =>
    data?.agents.filter((a) => a.acpAgent === id).length ?? 0

  return (
    <Overlay
      narrow
      title="Herbie"
      footer={
        <Link to="." search={closeOverlay}>
          <Button size="sm">Done</Button>
        </Link>
      }
    >
      <PanelSection
        label="Runtimes"
        note="Signing in here makes a runtime available. Which one an agent uses is picked on that agent."
      >
        {RUNTIMES.map((runtime) => {
          const count = used(runtime.id)
          return (
            <PanelRow
              key={runtime.id}
              k={runtime.name}
              v={
                count > 0
                  ? `Signed in, used by ${count} ${count === 1 ? 'agent' : 'agents'}`
                  : 'Needs a sign in before an agent can use it'
              }
            >
              <Button size="xs" variant={count > 0 ? 'quiet' : 'secondary'}>
                {count > 0 ? 'Sign out' : 'Sign in'}
              </Button>
            </PanelRow>
          )
        })}
      </PanelSection>

      <PanelSection label="General">
        <PanelRow k="Keep going when closed" v="Herbie waits in the menu bar">
          <Switch
            checked={background}
            onCheckedChange={setBackground}
            ariaLabel="Keep going when closed"
          />
        </PanelRow>
        <PanelRow
          k="Start when you log in"
          v="So the agents are up before you are"
        >
          <Switch
            checked={atLogin}
            onCheckedChange={setAtLogin}
            ariaLabel="Start when you log in"
          />
        </PanelRow>
      </PanelSection>
    </Overlay>
  )
}
