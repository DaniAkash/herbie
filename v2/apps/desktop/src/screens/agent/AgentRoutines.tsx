import { Bell, Clock, Trash2 } from 'lucide-react'
import { SwitchField } from '@/components/form/SwitchField'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import {
  type Routine,
  useDeleteRoutine,
  usePatchRoutine,
  useRoutines,
} from '@/modules/api/agents.hooks'

/**
 * Work the agent starts by itself.
 *
 * There is no add button, and that is the design rather than an omission.
 * Creating, editing and everything else is a conversation with the agent,
 * which has the tools to do it; what stays here is the two things worth
 * having without a conversation, turning one off and getting rid of it.
 *
 * Every row now carries state as well as configuration, because something
 * finally runs these. The state is read from the run ledger, so it survives
 * a restart and does not need the loop reaching into the webview.
 */
export function AgentRoutines({
  agentId,
  agentName,
}: {
  agentId: string
  agentName: string
}) {
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
        <PanelSection label="When something happens, one day">
          {evented.map((routine) => (
            <RoutineRow key={routine.id} routine={routine} agentId={agentId} />
          ))}
        </PanelSection>
      ) : null}

      {data.routines.length === 0 ? <Teach agentName={agentName} /> : null}

      <PanelSection label="Good manners">
        <PanelRow
          k="Keep working when closed"
          v="Herbie waits in the menu bar"
        />
        <PanelRow k="Rest overnight" v="Nothing runs 23:00 to 07:00" />
        <PanelRow
          k="Stop if it keeps failing"
          v="Backs off, then pauses the agent"
        />
      </PanelSection>
    </>
  )
}

/**
 * The empty state, which now has a job.
 *
 * With the form gone this is the only place that can say how a routine gets
 * made, so it says it and shows one, rather than describing an absence.
 */
function Teach({ agentName }: { agentName: string }) {
  return (
    <div className="mb-6 rounded-card bg-surface p-3.5 text-center shadow-hairline">
      <p className="text-[13px] text-ink-2 leading-snug">
        Nothing scheduled yet.
        <br />
        Ask {agentName} to do something regularly and it will set it up.
      </p>
      <p className="mt-2.5 rounded-control border border-line-strong border-dashed bg-inset px-2.5 py-2 text-left text-[12.5px] text-ink">
        <span className="mb-0.5 block text-[10.5px] text-ink-3 uppercase tracking-wider">
          Try saying
        </span>
        Check my GitHub notifications every weekday at 9
      </p>
    </div>
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

  // Two ways a routine cannot run: a cadence Herbie could not read, and an
  // event trigger, which nothing fires yet. Both have to be said rather
  // than shown as a switch that looks on and does nothing.
  const silent =
    routine.kind !== 'schedule' ||
    (routine.kind === 'schedule' && !routine.cron)

  return (
    <PanelRow
      icon={
        <Icon
          size={16}
          className={routine.failingSince ? 'text-red' : undefined}
        />
      }
      k={<span className="text-[13.5px]">{routine.name}</span>}
      v={<Status routine={routine} silent={silent} />}
    >
      <button
        type="button"
        aria-label={`Delete ${routine.name}`}
        onClick={() => remove.mutate({ id: routine.id, agentId })}
        className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-red"
      >
        <Trash2 size={14} />
      </button>
      <SwitchField
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

/**
 * What the row says under the name.
 *
 * Ordered by what the person most needs to know: a routine that cannot fire
 * at all, then one that is failing, then one running right now, then the
 * ordinary case of when it next goes.
 */
function Status({ routine, silent }: { routine: Routine; silent: boolean }) {
  if (routine.kind !== 'schedule') {
    return (
      <span className="text-ink-3">
        Waiting on something that cannot happen yet
      </span>
    )
  }
  if (silent) {
    return (
      <span className="text-red">
        {routine.cadence}, which Herbie could not read
      </span>
    )
  }
  if (routine.failingSince) {
    return <span className="text-red">Failing, so it has been paused</span>
  }
  if (routine.running) {
    return (
      <span>
        {routine.cadence} &middot;{' '}
        <span className="text-accent">running now</span>
      </span>
    )
  }
  if (!routine.enabled) return <span>{routine.cadence} &middot; off</span>
  return (
    <span>
      {routine.cadence}
      {routine.nextRunAt ? ` · next ${when(routine.nextRunAt)}` : ''}
    </span>
  )
}

/**
 * A next run, said the way a person would.
 *
 * An ISO timestamp in a panel row is a fact nobody can read at a glance,
 * and the exact minute is already in the cadence beside it.
 */
function when(iso: string): string {
  const at = new Date(iso)
  const now = new Date()
  const time = at.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  const days = Math.round(
    (new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  )
  if (days === 0) return `today ${time}`
  if (days === 1) return `tomorrow ${time}`
  if (days < 7) {
    return `${at.toLocaleDateString(undefined, { weekday: 'long' })} ${time}`
  }
  return at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
