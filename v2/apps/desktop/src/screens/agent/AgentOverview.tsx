import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import { Textarea } from '@/components/ui/textarea'
import {
  type Agent,
  useDeleteAgent,
  usePatchAgent,
} from '@/modules/api/agents.hooks'
import { useProbeRuntime, useRuntimes } from '@/modules/api/runtimes.hooks'
import {
  RuntimeSection,
  TelegramSection,
} from '@/screens/agent/agent-overview.components'
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
  // The probe's own answer wins while it is on screen, so the rows change the
  // moment it lands rather than after the list is refetched.
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

      <RuntimeSection
        agent={agent}
        runtime={runtime}
        runtimes={runtimes}
        probing={probe.isPending}
        onRuntime={(acpAgent) => {
          // The model it was on means nothing to a different runtime, so it
          // is cleared rather than carried across as a value the new one will
          // refuse.
          patch.mutate({ id: agent.id, acpAgent, model: null })
          probe.mutate({ id: acpAgent })
        }}
        onModel={(model) => patch.mutate({ id: agent.id, model })}
        onEffort={(effort) => patch.mutate({ id: agent.id, effort })}
        onReprobe={() => probe.mutate({ id: agent.acpAgent })}
      />

      <TelegramSection
        agent={agent}
        onResults={(telegramResults) =>
          patch.mutate({ id: agent.id, telegramResults })
        }
      />

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
