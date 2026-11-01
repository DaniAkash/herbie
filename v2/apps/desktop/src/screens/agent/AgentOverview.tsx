import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select'
import { Switch } from '@/components/motion/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import type { Agent } from '@/modules/api/agents.hooks'

const RUNTIMES = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'codex', label: 'Codex' },
  { value: 'gemini', label: 'Gemini' },
]

const MODELS: Record<string, string[]> = {
  claude: ['Opus 5', 'Sonnet 5.5', 'Haiku 5.5'],
  codex: ['GPT-5.2', 'GPT-5.2 mini'],
  gemini: ['Gemini 3', 'Gemini 3 Flash'],
}

const EFFORTS = ['low', 'medium', 'high'] as const

/**
 * Everything that is this agent's own: its brief, its runtime, and its
 * Telegram bot. None of these are app settings.
 */
export function AgentOverview({ agent }: { agent: Agent }) {
  const [runtime, setRuntime] = useState(agent.acpAgent)
  const [model, setModel] = useState(agent.model ?? '')
  const [effort, setEffort] = useState(agent.effort)
  const [telegram, setTelegram] = useState(Boolean(agent.telegramBot))

  return (
    <>
      <section className="mb-6">
        <span className="mb-1.5 block font-medium text-[12.5px] text-ink-2">
          What it does
        </span>
        {/*
          Neither registry ships a multiline field: beui's Input is
          single-line and beautifui has no text input at all. This matches
          Input's own surface so the panel still reads as one set of controls.
        */}
        <textarea
          defaultValue={agent.brief}
          className="min-h-24 w-full resize-y rounded-control bg-surface px-3.5 py-2.5 text-ink shadow-hairline outline-none focus:shadow-[0_0_0_1px_var(--accent)]"
        />
      </section>

      <PanelSection
        label="Runtime"
        note="Each agent keeps its own runtime and folder, so one can run on Claude Code while another runs on Codex."
      >
        <PanelRow k="Runs on">
          <Select
            value={runtime}
            onValueChange={(next) => {
              setRuntime(next)
              setModel(MODELS[next]?.[0] ?? '')
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
              {RUNTIMES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelRow>

        <PanelRow k="Model">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              {(MODELS[runtime] ?? []).map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelRow>

        <PanelRow k="Effort">
          <Tabs value={effort} variant="segment" onValueChange={setEffort}>
            <TabsList>
              {EFFORTS.map((e) => (
                <TabsTrigger key={e} value={e}>
                  {e}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
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
