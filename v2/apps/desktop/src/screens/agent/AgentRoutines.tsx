import { Bell, Clock, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Switch } from '@/components/motion/switch'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import { type Routine, useRoutines } from '@/modules/api/agents.hooks'

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
            <RoutineRow key={routine.id} routine={routine} />
          ))}
        </PanelSection>
      ) : null}

      {evented.length > 0 ? (
        <PanelSection label="When something happens">
          {evented.map((routine) => (
            <RoutineRow key={routine.id} routine={routine} />
          ))}
        </PanelSection>
      ) : null}

      {data.routines.length === 0 ? (
        <p className="mb-4 text-ink-2">
          Nothing scheduled. This agent only works when you ask it to.
        </p>
      ) : null}

      <Button size="sm" variant="quiet" className="mb-6 w-full">
        <Plus size={14} />
        Add a routine
      </Button>

      <PanelSection label="Good manners">
        <Manner
          k="Keep working when closed"
          v="Herbie waits in the menu bar"
          initial
        />
        <Manner
          k="Rest overnight"
          v="Nothing runs from eleven to seven"
          initial
        />
        <Manner
          k="Stop if it keeps failing"
          v="Waits longer, then pauses itself"
          initial
        />
      </PanelSection>
    </>
  )
}

function RoutineRow({ routine }: { routine: Routine }) {
  const [on, setOn] = useState(routine.enabled)
  const Icon = routine.kind === 'event' ? Bell : Clock
  return (
    <div className="flex items-start gap-3 px-0.5 py-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-[13.5px]">{routine.name}</span>
        <span className="mt-0.5 block text-[12.5px] text-ink-2">
          {routine.cadence}
        </span>
      </span>
      <Switch checked={on} onCheckedChange={setOn} ariaLabel={routine.name} />
    </div>
  )
}

function Manner({ k, v, initial }: { k: string; v: string; initial: boolean }) {
  const [on, setOn] = useState(initial)
  return (
    <PanelRow k={k} v={v}>
      <Switch checked={on} onCheckedChange={setOn} ariaLabel={k} />
    </PanelRow>
  )
}
