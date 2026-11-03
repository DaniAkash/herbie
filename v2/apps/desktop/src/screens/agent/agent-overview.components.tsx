import { RefreshCw } from 'lucide-react'
import { EffortControl } from '@/components/agent/EffortControl'
import { Switch } from '@/components/motion/switch'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { shortenHome } from '@/lib/paths'
import type { Agent } from '@/modules/api/agents.hooks'
import type { Runtime } from '@/modules/api/runtimes.hooks'

export interface RuntimeSectionProps {
  agent: Agent
  runtime: Runtime | undefined
  runtimes: readonly Runtime[]
  probing: boolean
  onRuntime: (id: string) => void
  onModel: (model: string) => void
  onEffort: (effort: string) => void
  onReprobe: () => void
}

/**
 * Which coding agent this one runs on, and what that runtime allows.
 *
 * The model and effort rows are absent rather than disabled when the runtime
 * reports no picker, for the same reason they are in the create flow: a
 * control the runtime will reject fails silently on the next prompt.
 */
export function RuntimeSection({
  agent,
  runtime,
  runtimes,
  probing,
  onRuntime,
  onModel,
  onEffort,
  onReprobe,
}: RuntimeSectionProps) {
  const usable = runtimes.filter((r) => r.installState !== 'not-installed')

  return (
    <PanelSection
      label="Runtime"
      note="Each agent keeps its own runtime and folder, so one can run on Claude Code while another runs on Codex."
    >
      <PanelRow k="Runs on">
        <Select
          value={agent.acpAgent}
          onValueChange={onRuntime}
          items={usable.map((r) => ({ value: r.id, label: r.displayName }))}
        >
          <SelectTrigger className="w-[150px]" aria-label="Runs on">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            {usable.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PanelRow>

      {runtime && runtime.modelValues.length > 0 ? (
        <PanelRow k="Model">
          <Select value={agent.model} onValueChange={onModel}>
            <SelectTrigger className="w-[150px]" aria-label="Model">
              <SelectValue placeholder="Its default" />
            </SelectTrigger>
            <SelectContent>
              {runtime.modelValues.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelRow>
      ) : null}

      {runtime && runtime.efforts.length > 0 ? (
        <PanelRow k="Effort">
          <EffortControl
            values={runtime.efforts}
            value={agent.effort}
            onChange={onEffort}
          />
        </PanelRow>
      ) : null}

      <PanelRow
        k="Ask it again"
        v={
          runtime?.probedAt
            ? `It last answered ${when(runtime.probedAt)}`
            : 'It has not been asked what it can do'
        }
      >
        <button
          type="button"
          aria-label="Ask the runtime again"
          disabled={probing}
          onClick={onReprobe}
          className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={probing ? 'animate-spin' : undefined}
          />
        </button>
      </PanelRow>

      <PanelRow
        k="Its own folder"
        v={<span className="font-mono">{shortenHome(agent.workspaceDir)}</span>}
      />
    </PanelSection>
  )
}

/**
 * Its own bot, and whether work goes there too.
 *
 * Both switches are disabled without a bot rather than hidden, because the
 * row is also how you find out the agent has no bot yet.
 */
export function TelegramSection({
  agent,
  onResults,
}: {
  agent: Agent
  onResults: (on: boolean) => void
}) {
  return (
    <PanelSection
      label="Telegram"
      note="Each agent has its own bot, so a reply always reaches the right one."
    >
      <PanelRow
        k={
          <span className="font-mono text-[13px]">
            {agent.telegramBot ?? 'Not connected'}
          </span>
        }
        v={
          agent.telegramBot
            ? `Its own bot. Message it to reach ${agent.name}.`
            : 'Connect a bot to reach this agent from your phone.'
        }
      />
      <PanelRow
        k="Send its work here too"
        v="Routine results arrive in Telegram as well"
      >
        <Switch
          checked={agent.telegramResults}
          disabled={!agent.telegramBot}
          onCheckedChange={onResults}
          ariaLabel="Send work to Telegram"
        />
      </PanelRow>
    </PanelSection>
  )
}

/** Roughly how long ago, which is all the probe row needs to say. */
function when(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}
