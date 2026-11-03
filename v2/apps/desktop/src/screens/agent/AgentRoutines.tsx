import { Link } from '@tanstack/react-router'
import { Bell, Clock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { Switch } from '@/components/motion/switch'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import {
  type Routine,
  useDeleteRoutine,
  usePatchRoutine,
  useRoutines,
} from '@/modules/api/agents.hooks'
import { openOverlay } from '@/modules/navigation/overlay'

/**
 * Work the agent starts by itself.
 *
 * A schedule and an event are one concept with two triggers, because the loop
 * enqueues both the same way once they fire.
 */
export function AgentRoutines({ agentId }: { agentId: string }) {
  const { data, isPending, isError } = useRoutines({ variables: { agentId } })

  if (isPending) return <p className="text-ink-3">Reading its routines...</p>
  if (isError) return <p className="text-red">The sidecar did not answer.</p>

  const scheduled = data.routines.filter((r) => r.kind === 'schedule')
  const evented = data.routines.filter((r) => r.kind === 'event')

  return (
    <>
      {scheduled.length > 0 ? (
        <PanelSection label="On a schedule">
          {scheduled.map((routine) => (
            <RoutineRow key={routine.id} routine={routine} agentId={agentId} />
          ))}
        </PanelSection>
      ) : null}

      {evented.length > 0 ? (
        <PanelSection label="When something happens">
          {evented.map((routine) => (
            <RoutineRow key={routine.id} routine={routine} agentId={agentId} />
          ))}
        </PanelSection>
      ) : null}

      {data.routines.length === 0 ? (
        <p className="mb-4 text-ink-2">
          Nothing scheduled. This agent only works when you ask it to.
        </p>
      ) : null}

      <Link to="." search={openOverlay('routine')} className="mb-6 block">
        <Button size="sm" variant="quiet" className="w-full">
          <Plus size={14} />
          Add a routine
        </Button>
      </Link>

      <PanelSection label="Good manners">
        <PanelRow
          k="Keep working when closed"
          v="Herbie waits in the menu bar"
        />
        <PanelRow k="Rest overnight" v="Nothing runs from eleven to seven" />
        <PanelRow
          k="Stop if it keeps failing"
          v="Waits longer, then pauses itself"
        />
      </PanelSection>
    </>
  )
}

function RoutineRow({
  routine,
  agentId,
}: {
  routine: Routine
  agentId: string
}) {
  const patch = usePatchRoutine()
  const remove = useDeleteRoutine()
  const Icon = routine.kind === 'event' ? Bell : Clock

  // A schedule with no cron never fires, which the panel has to say rather
  // than showing a switch that looks on and does nothing.
  const silent = routine.kind === 'schedule' && !routine.cron

  return (
    <PanelRow
      icon={<Icon size={16} />}
      k={<span className="text-[13.5px]">{routine.name}</span>}
      v={
        silent ? (
          <span className="text-red">
            {routine.cadence}, which Herbie could not read
          </span>
        ) : (
          routine.cadence
        )
      }
    >
      <button
        type="button"
        aria-label={`Delete ${routine.name}`}
        onClick={() => remove.mutate({ id: routine.id, agentId })}
        className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-red"
      >
        <Trash2 size={14} />
      </button>
      <Switch
        checked={routine.enabled}
        disabled={silent}
        onCheckedChange={(enabled) =>
          patch.mutate({ id: routine.id, agentId, enabled })
        }
        ariaLabel={routine.name}
      />
    </PanelRow>
  )
}
