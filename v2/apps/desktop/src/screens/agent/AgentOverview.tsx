import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Switch } from '@/components/motion/switch'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import type { Agent } from '@/modules/api/agents.hooks'

const RUNTIME_NAME: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini',
}

const EFFORTS = ['low', 'medium', 'high'] as const

/**
 * Everything that is this agent's own: its brief, its runtime, and its
 * Telegram bot. None of these are app settings.
 */
export function AgentOverview({ agent }: { agent: Agent }) {
  const [effort, setEffort] = useState(agent.effort)
  const [telegram, setTelegram] = useState(Boolean(agent.telegramBot))

  return (
    <>
      <section className="mb-6">
        <span className="mb-1.5 block font-medium text-[12.5px] text-ink-2">
          What it does
        </span>
        <textarea
          defaultValue={agent.brief}
          className="min-h-24 w-full resize-y rounded-control bg-surface px-3.5 py-2.5 text-ink shadow-hairline outline-none focus:shadow-[0_0_0_1px_var(--accent)]"
        />
      </section>

      <PanelSection
        label="Runtime"
        note="Each agent keeps its own runtime and folder, so one can run on Claude Code while another runs on Codex."
      >
        <PanelRow
          k="Runs on"
          v={RUNTIME_NAME[agent.acpAgent] ?? agent.acpAgent}
        >
          <Button size="xs">Change</Button>
        </PanelRow>
        <PanelRow k="Model" v={agent.model ?? 'Default'}>
          <Button size="xs" variant="quiet">
            Change
          </Button>
        </PanelRow>
        <PanelRow k="Effort">
          <div className="inline-flex gap-0.5 rounded-full bg-field p-0.5 shadow-hairline">
            {EFFORTS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={effort === e}
                onClick={() => setEffort(e)}
                className={
                  effort === e
                    ? 'rounded-full bg-surface px-2.5 py-1 font-medium text-[12.5px] text-ink shadow-xs'
                    : 'rounded-full px-2.5 py-1 font-medium text-[12.5px] text-ink-3 hover:text-ink'
                }
              >
                {e}
              </button>
            ))}
          </div>
        </PanelRow>
        <PanelRow
          k="Its own folder"
          v={<span className="font-mono">{agent.workspaceDir}</span>}
        >
          <button
            type="button"
            aria-label="Open folder"
            className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink"
          >
            <ExternalLink size={15} />
          </button>
        </PanelRow>
      </PanelSection>

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
            checked={telegram}
            onCheckedChange={setTelegram}
            ariaLabel="Send work to Telegram"
          />
        </PanelRow>
      </PanelSection>

      <PanelSection>
        <PanelRow
          k={<span className="text-red">Delete {agent.name}</span>}
          v="Removes its routines and folder"
        >
          <Button size="xs" variant="quiet" className="text-red">
            Delete
          </Button>
        </PanelRow>
      </PanelSection>
    </>
  )
}
