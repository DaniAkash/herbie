import { useNavigate } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { shortenHome } from '@/lib/paths'
import {
  type Agent,
  useDeleteAgent,
  usePatchAgent,
} from '@/modules/api/agents.hooks'
import { useProbeRuntime, useRuntimes } from '@/modules/api/runtimes.hooks'
import { DeleteAgentDialog } from '@/screens/agent/DeleteAgentDialog'

/**
 * Everything that is this agent's own: its brief, its runtime, and its
 * Telegram bot. None of these are app settings.
 */
export function AgentOverview({ agent }: { agent: Agent }) {
  const patch = usePatchAgent()
  const probe = useProbeRuntime()
  const { data } = useRuntimes()
  const navigate = useNavigate()
  const remove = useDeleteAgent()
  const [confirming, setConfirming] = useState(false)

  const runtimes = data?.runtimes ?? []
  const live =
    probe.data?.runtime.id === agent.acpAgent ? probe.data.runtime : undefined
  const runtime = live ?? runtimes.find((r) => r.id === agent.acpAgent)

  return (
    <>
      <section className="mb-6">
        <span className="mb-1.5 block font-medium text-[12.5px] text-ink-2">
          What it does
        </span>
        <Textarea
          key={agent.id}
          defaultValue={agent.brief}
          onBlur={(event) => {
            // On blur rather than on every keystroke: a brief is a paragraph,
            // and a write per character would be a write per character.
            if (event.target.value !== agent.brief) {
              patch.mutate({ id: agent.id, brief: event.target.value })
            }
          }}
          className="min-h-24"
        />
      </section>

      <PanelSection
        label="Runtime"
        note="Each agent keeps its own runtime and folder, so one can run on Claude Code while another runs on Codex."
      >
        <PanelRow k="Runs on">
          <Select
            value={agent.acpAgent}
            onValueChange={(acpAgent) => {
              // The model it was on means nothing to a different runtime, so
              // it is cleared rather than carried across as a value the new
              // one will refuse.
              patch.mutate({ id: agent.id, acpAgent, model: null })
              probe.mutate({ id: acpAgent })
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
              {runtimes
                .filter((r) => r.installState !== 'not-installed')
                .map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.displayName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </PanelRow>

        {runtime && runtime.modelValues.length > 0 ? (
          <PanelRow k="Model">
            <Select
              value={agent.model ?? ''}
              onValueChange={(model) => patch.mutate({ id: agent.id, model })}
            >
              <SelectTrigger className="w-[150px]">
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
            {runtime.efforts.length <= 3 ? (
              <Tabs
                value={agent.effort}
                variant="segment"
                onValueChange={(effort) =>
                  patch.mutate({ id: agent.id, effort })
                }
              >
                <TabsList>
                  {runtime.efforts.map((e) => (
                    <TabsTrigger key={e} value={e}>
                      {e}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : (
              <Select
                value={agent.effort}
                onValueChange={(effort) =>
                  patch.mutate({ id: agent.id, effort })
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {runtime.efforts.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
            disabled={probe.isPending}
            onClick={() => probe.mutate({ id: agent.acpAgent })}
            className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={probe.isPending ? 'animate-spin' : undefined}
            />
          </button>
        </PanelRow>

        <PanelRow
          k="Its own folder"
          v={
            <span className="font-mono">{shortenHome(agent.workspaceDir)}</span>
          }
        />
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
            checked={agent.telegramResults}
            disabled={!agent.telegramBot}
            onCheckedChange={(telegramResults) =>
              patch.mutate({ id: agent.id, telegramResults })
            }
            ariaLabel="Send work to Telegram"
          />
        </PanelRow>
      </PanelSection>

      <PanelSection>
        <PanelRow
          k={<span className="text-red">Delete {agent.name}</span>}
          v="Removes its routines and folder"
        >
          <Button
            size="xs"
            variant="quiet"
            className="text-red"
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        </PanelRow>
      </PanelSection>

      <DeleteAgentDialog
        agent={agent}
        open={confirming}
        pending={remove.isPending}
        onOpenChange={setConfirming}
        onConfirm={async () => {
          await remove.mutateAsync({ id: agent.id })
          setConfirming(false)
          navigate({ to: '/' })
        }}
      />
    </>
  )
}

/** Roughly how long ago, which is all this row needs to say. */
function when(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}
