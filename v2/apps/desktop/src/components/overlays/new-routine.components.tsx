import { Check, X } from 'lucide-react'
import { Switch } from '@/components/motion/switch'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import type { Agent } from '@/modules/api/agents.hooks'

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="mb-1.5 block font-medium text-[12.5px] text-ink-2">
        {label}
      </span>
      {children}
    </div>
  )
}

/**
 * What the sidecar made of the cadence.
 *
 * Shown as a failure rather than hidden when it did not parse: a routine
 * stored without a cron is one that never fires, and finding that out at
 * seven tomorrow is worse than being told now.
 */
export function CadenceLine({
  reading,
  cron,
  pending,
}: {
  reading?: string
  cron?: string | null
  pending: boolean
}) {
  if (pending) {
    return <p className="mt-1.5 text-[12.5px] text-ink-3">Reading that...</p>
  }
  if (!cron) {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-red">
        <X size={13} />
        Herbie could not read that, so it will not run on its own.
      </p>
    )
  }
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink-2">
      <Check size={13} className="text-accent" />
      Herbie read that as {reading}
      <code className="rounded bg-field px-1.5 py-0.5 font-mono text-[11.5px]">
        {cron}
      </code>
    </p>
  )
}

/** Where a result lands. The conversation always, Telegram if it has a bot. */
export function Delivery({
  agent,
  telegram,
  onTelegram,
}: {
  agent: Agent | undefined
  telegram: boolean
  onTelegram: (on: boolean) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block font-medium text-[12.5px] text-ink-2">
        Where the result goes
      </span>
      <PanelSection>
        <PanelRow k="This conversation" v="Where you already talk to it">
          <span className="rounded-full bg-field px-2 py-0.5 text-[11.5px] text-ink-2">
            always
          </span>
        </PanelRow>
        <PanelRow
          k="Telegram too"
          v={
            agent?.telegramBot
              ? `Sent from ${agent.telegramBot}`
              : 'Needs its bot connected first'
          }
        >
          <Switch
            checked={telegram}
            onCheckedChange={onTelegram}
            disabled={!agent?.telegramBot}
            ariaLabel="Telegram too"
          />
        </PanelRow>
      </PanelSection>
    </div>
  )
}
