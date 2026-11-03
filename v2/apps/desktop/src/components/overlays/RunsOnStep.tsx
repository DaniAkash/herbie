import { CheckCircle2, Info, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Controller } from 'react-hook-form'
import { Card, CardContent } from '@/components/motion/card'
import { Input } from '@/components/motion/input'
import { RadioGroup } from '@/components/motion/radio'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import type { AgentForm } from '@/components/overlays/NewAgentOverlay'
import { RuntimeRow } from '@/components/overlays/new-agent.components'
import {
  type Runtime,
  useProbeRuntime,
  useRuntimes,
} from '@/modules/api/runtimes.hooks'

/**
 * How it runs: the runtime, and whatever that runtime says it can be told.
 *
 * The model and effort rows are drawn from the probe rather than from a list
 * in the app, and they are absent rather than disabled when the runtime
 * exposes no picker: offering a control the runtime will reject produces a
 * prompt that fails with nothing in the logs.
 */
export function RunsOnStep({ form }: { form: AgentForm }) {
  const { data, isPending } = useRuntimes()
  const probe = useProbeRuntime()
  const chosen = form.watch('acpAgent')

  const runtimes = data?.runtimes ?? []
  const runtime = runtimes.find((r) => r.id === chosen)
  // The probe's own answer wins while it is on screen, so the rows fill in
  // the moment it lands rather than after the list is refetched.
  const probed: Runtime | undefined =
    probe.data?.runtime.id === chosen ? probe.data.runtime : runtime

  return (
    <div className="grid gap-5">
      <section>
        <div className="mb-2 font-medium text-[13px] text-ink-3">Runs on</div>
        {isPending ? (
          <PickerSkeleton />
        ) : (
          <Card
            variant="outlined"
            size="compact"
            className="!gap-0 !py-0 overflow-hidden"
          >
            <CardContent className="grid gap-0 p-0 py-1">
              <Controller
                control={form.control}
                name="acpAgent"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={(id) => {
                      field.onChange(id)
                      // The model and effort the previous runtime offered mean
                      // nothing to this one, so they go rather than being
                      // carried across as values it will refuse.
                      form.setValue('model', null)
                      form.setValue('effort', 'medium')
                      probe.mutate({ id })
                    }}
                    aria-label="Runtime"
                  >
                    {runtimes.map((r) => (
                      <RuntimeRow key={r.id} runtime={r} />
                    ))}
                  </RadioGroup>
                )}
              />
            </CardContent>
          </Card>
        )}
        <ProbeLine pending={probe.isPending} runtime={probed} />
      </section>

      {probed && probed.modelValues.length > 0 ? (
        <Controller
          control={form.control}
          name="model"
          render={({ field }) => (
            <Row label="Model">
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Its default" />
                </SelectTrigger>
                <SelectContent>
                  {probed.modelValues.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          )}
        />
      ) : null}

      {probed && probed.efforts.length > 0 ? (
        <Controller
          control={form.control}
          name="effort"
          render={({ field }) => (
            <Row label="Effort">
              <EffortControl
                values={probed.efforts}
                value={field.value ?? 'medium'}
                onChange={field.onChange}
              />
            </Row>
          )}
        />
      ) : null}

      <section>
        <div className="mb-2 font-medium text-[13px] text-ink-3">
          Its own folder
        </div>
        <Controller
          control={form.control}
          name="workspaceDir"
          render={({ field }) => (
            <Input
              value={field.value ?? ''}
              onChange={field.onChange}
              placeholder="Made for it under ~/.herbie/agents"
              className="font-mono text-[12.5px]"
            />
          )}
        />
        <p className="mt-2 text-[12.5px] text-ink-2">
          Made fresh, so two agents editing the same repository never fight over
          one working tree.
        </p>
      </section>
    </div>
  )
}

/**
 * Effort, as however many levels the runtime actually reports.
 *
 * A segment for three or fewer and a select beyond that: claude-agent-acp
 * reports six, and six segments in a 380px modal is a row of unreadable
 * slivers.
 */
function EffortControl({
  values,
  value,
  onChange,
}: {
  values: readonly string[]
  value: string
  onChange: (next: string) => void
}) {
  // Whatever was carried in from a previous runtime may not be on offer here.
  useEffect(() => {
    if (values.length > 0 && !values.includes(value)) {
      onChange(values.includes('medium') ? 'medium' : (values[0] as string))
    }
  }, [values, value, onChange])

  if (values.length <= 3) {
    return (
      <Tabs value={value} variant="segment" onValueChange={onChange}>
        <TabsList>
          {values.map((e) => (
            <TabsTrigger key={e} value={e}>
              {e}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    )
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[170px]">
        <SelectValue placeholder="Its default" />
      </SelectTrigger>
      <SelectContent>
        {values.map((e) => (
          <SelectItem key={e} value={e}>
            {e}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 font-medium">{label}</span>
      {children}
    </div>
  )
}

/** What the runtime answered, in the words the row would use. */
function ProbeLine({
  pending,
  runtime,
}: {
  pending: boolean
  runtime: Runtime | undefined
}) {
  if (pending) {
    return (
      <Note icon={<Loader2 size={14} className="animate-spin" />}>
        Asking it what it can do...
      </Note>
    )
  }
  if (!runtime?.probedAt) return null

  if (runtime.probeError) {
    return (
      <Note icon={<Info size={14} />}>
        It did not answer: {runtime.probeError}. It can still be used.
      </Note>
    )
  }
  if (runtime.modelValues.length === 0) {
    return (
      <Note icon={<Info size={14} />}>
        {runtime.displayName} has no model picker. It runs on whatever it is set
        to.
      </Note>
    )
  }
  return (
    <Note icon={<CheckCircle2 size={14} className="text-accent" />}>
      {runtime.displayName} answered:{' '}
      {count(runtime.modelValues.length, 'model')}
      {runtime.efforts.length > 0
        ? `, and effort in ${count(runtime.efforts.length, 'level')}`
        : ''}
      .
    </Note>
  )
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']

function count(n: number, noun: string): string {
  const word = WORDS[n] ?? String(n)
  return `${word} ${noun}${n === 1 ? '' : 's'}`
}

function Note({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-ink-2">
      <span className="mt-[1px] shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  )
}

function PickerSkeleton() {
  return (
    <div className="grid gap-1.5" aria-hidden="true">
      <div className="h-11 rounded-control bg-hover" />
      <div className="h-11 rounded-control bg-hover" />
      <div className="h-11 rounded-control bg-hover" />
    </div>
  )
}
