import { Link } from '@tanstack/react-router'
import { MonitorCogIcon, MoonStarIcon, SunIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { SwitchField } from '@/components/form/SwitchField'
import { Overlay } from '@/components/shell/Overlay'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import { Button } from '@/components/ui/button'
import { useAgents } from '@/modules/api/agents.hooks'
import { closeOverlay } from '@/modules/navigation/overlay'
import { setTheme, useTheme } from '@/modules/theme/theme'

const THEME_OPTIONS = [
  { icon: MonitorCogIcon, value: 'system' },
  { icon: SunIcon, value: 'light' },
  { icon: MoonStarIcon, value: 'dark' },
] as const

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
          <Button size="sm" variant="secondary">
            Done
          </Button>
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
              <Button size="xs" variant={count > 0 ? 'ghost' : 'secondary'}>
                {count > 0 ? 'Sign out' : 'Sign in'}
              </Button>
            </PanelRow>
          )
        })}
      </PanelSection>

      <PanelSection label="Appearance">
        <PanelRow k="Theme">
          <ThemeToggle />
        </PanelRow>
      </PanelSection>

      <PanelSection label="General">
        <PanelRow k="Keep going when closed" v="Herbie waits in the menu bar">
          <SwitchField
            checked={background}
            onCheckedChange={setBackground}
            ariaLabel="Keep going when closed"
          />
        </PanelRow>
        <PanelRow
          k="Start when you log in"
          v="So the agents are up before you are"
        >
          <SwitchField
            checked={atLogin}
            onCheckedChange={setAtLogin}
            ariaLabel="Start when you log in"
          />
        </PanelRow>
      </PanelSection>
    </Overlay>
  )
}

/** Native radios provide keyboard navigation while the outline follows selection. */
function ThemeToggle() {
  const theme = useTheme()
  const reduce = useReducedMotion()
  return (
    <fieldset
      aria-label="Theme"
      className="inline-flex items-center overflow-hidden rounded-control border border-line bg-inset p-0.5"
    >
      {THEME_OPTIONS.map(({ icon: Icon, value }) => (
        <label
          key={value}
          className="relative grid size-7 cursor-pointer place-items-center rounded-control text-ink-3 transition-colors hover:text-ink has-[:checked]:text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2"
        >
          <input
            className="sr-only"
            type="radio"
            name="theme"
            value={value}
            checked={theme === value}
            onChange={() => setTheme(value)}
            aria-label={`Switch to ${value} theme`}
          />
          {theme === value && (
            <motion.span
              layoutId="theme-option"
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: 'spring', bounce: 0.1, duration: 0.75 }
              }
              className="pointer-events-none absolute inset-0 rounded-control border border-line-strong"
            />
          )}
          <Icon aria-hidden="true" className="size-3.5" />
        </label>
      ))}
    </fieldset>
  )
}
