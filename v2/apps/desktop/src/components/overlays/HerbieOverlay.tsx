import { Link } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-shell'
import { MonitorCogIcon, MoonStarIcon, SunIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { SwitchField } from '@/components/form/SwitchField'
import { Overlay } from '@/components/shell/Overlay'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAgents } from '@/modules/api/agents.hooks'
import {
  useDelivered,
  useSetSetting,
  useSettings,
} from '@/modules/api/notifications.hooks'
import { isDesktop } from '@/modules/host/host'
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

      <NotificationSettings />

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

const DONE_AFTER = ['15', '30', '45', '60', '120', '300'] as const

function afterLabel(seconds: string): string {
  const n = Number(seconds)
  return n < 60 ? `${n} seconds` : `${n / 60} minutes`
}

/**
 * What is worth an interruption.
 *
 * The status line resolves first match wins over what the window can actually
 * observe. It never asks the permission API, which answers granted on every
 * desktop platform whatever System Settings says, so claiming "on" from it
 * would be the bug that makes the whole feature look broken.
 */
/** The pane macOS opens on, since the app cannot read or set that switch. */
const NOTIFICATION_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.notifications'

function NotificationSettings() {
  const { data, isPending, isError } = useSettings()
  const { data: delivered } = useDelivered()
  const write = useSetSetting()

  const settings = data?.settings
  const flag = (key: string, fallback = true): boolean =>
    (settings?.[key] ?? (fallback ? '1' : '0')) === '1'
  const set = (key: string) => (on: boolean) =>
    write.mutate({ key, value: on ? '1' : '0' })

  const enabled = flag('notify.enabled')
  const status = !enabled
    ? 'Off'
    : delivered === false
      ? 'Nothing delivered yet'
      : 'On'

  if (isPending) {
    return (
      <PanelSection label="Notifications">
        <PanelRow k="Loading" v="Reading your settings..." />
      </PanelSection>
    )
  }

  if (isError) {
    return (
      <PanelSection label="Notifications">
        <PanelRow k="Unavailable" v="The sidecar did not answer." />
      </PanelSection>
    )
  }

  return (
    <>
      <PanelSection
        label="Notifications"
        note={
          enabled && delivered === false
            ? 'No banner has appeared yet. If none ever does, Herbie is switched off under Notifications, which this window cannot read.'
            : undefined
        }
      >
        <PanelRow k="Status" v={status}>
          {enabled && delivered === false && isDesktop() ? (
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                void open(NOTIFICATION_SETTINGS_URL)
              }}
            >
              Open settings
            </Button>
          ) : null}
        </PanelRow>
        <PanelRow
          k="Notify me"
          v="When an agent needs you and you are not looking"
        >
          <SwitchField
            checked={enabled}
            onCheckedChange={set('notify.enabled')}
            ariaLabel="Notify me"
          />
        </PanelRow>
      </PanelSection>

      <PanelSection label="What is worth an interruption">
        <PanelRow k="An agent needs me" v="Blocked and cannot continue">
          <SwitchField
            checked={flag('notify.needsYou')}
            onCheckedChange={set('notify.needsYou')}
            disabled={!enabled}
            ariaLabel="An agent needs me"
          />
        </PanelRow>
        <PanelRow k="A turn failed" v="Ended with an error">
          <SwitchField
            checked={flag('notify.turnFailed')}
            onCheckedChange={set('notify.turnFailed')}
            disabled={!enabled}
            ariaLabel="A turn failed"
          />
        </PanelRow>
        <PanelRow
          k="An agent parked itself"
          v="Stopped after repeated failures"
        >
          <SwitchField
            checked={flag('notify.agentParked')}
            onCheckedChange={set('notify.agentParked')}
            disabled={!enabled}
            ariaLabel="An agent parked itself"
          />
        </PanelRow>
        <PanelRow k="A turn finished" v="Only if it ran longer than">
          <span className="flex items-center gap-2">
            <Select
              value={settings?.['notify.doneAfterSeconds'] ?? '45'}
              onValueChange={(next) => {
                if (next !== null) {
                  write.mutate({ key: 'notify.doneAfterSeconds', value: next })
                }
              }}
            >
              <SelectTrigger className="w-[120px]" aria-label="Finished after">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DONE_AFTER.map((seconds) => (
                  <SelectItem key={seconds} value={seconds}>
                    {afterLabel(seconds)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SwitchField
              checked={flag('notify.turnDone')}
              onCheckedChange={set('notify.turnDone')}
              disabled={!enabled}
              ariaLabel="A turn finished"
            />
          </span>
        </PanelRow>
        <PanelRow k="Sound" v="On the banner">
          <SwitchField
            checked={flag('notify.sound')}
            onCheckedChange={set('notify.sound')}
            disabled={!enabled}
            ariaLabel="Sound"
          />
        </PanelRow>
      </PanelSection>

      {write.isError ? (
        <p className="-mt-4 mb-6 text-[12.5px] text-red">
          That did not save. Try again.
        </p>
      ) : null}
    </>
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
