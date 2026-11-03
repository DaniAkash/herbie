import { useEffect } from 'react'
import { Controller } from 'react-hook-form'
import { EffortControl } from '@/components/agent/EffortControl'
import { Input } from '@/components/motion/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select'
import {
  PickerSkeleton,
  ProbeLine,
  Row,
  RuntimePicker,
} from '@/components/overlays/runs-on.components'
import type { AgentForm } from '@/modules/api/forms'
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
  // The probe's own answer wins while it is on screen, so the rows fill in
  // the moment it lands rather than after the list is refetched.
  const probed: Runtime | undefined =
    probe.data && probe.data.runtime.id === chosen
      ? probe.data.runtime
      : runtimes.find((r) => r.id === chosen)

  const efforts = probed?.efforts ?? []
  const effort = form.watch('effort')
  // The only unavoidable effect here: which efforts exist is not known until
  // the probe answers, so an effort carried over from the previously chosen
  // runtime can only be corrected once that lands.
  useEffect(() => {
    if (efforts.length > 0 && effort && !efforts.includes(effort)) {
      form.setValue(
        'effort',
        efforts.includes('medium') ? 'medium' : efforts[0],
      )
    }
  }, [efforts, effort, form.setValue])

  return (
    <div className="grid gap-5">
      <section>
        <div className="mb-2 font-medium text-[13px] text-ink-3">Runs on</div>
        {isPending ? (
          <PickerSkeleton />
        ) : (
          <Controller
            control={form.control}
            name="acpAgent"
            render={({ field }) => (
              <RuntimePicker
                runtimes={runtimes}
                value={field.value}
                onSelect={(id) => {
                  field.onChange(id)
                  // The model the previous runtime offered means nothing to
                  // this one, so it goes rather than being carried across as
                  // a value it will refuse.
                  form.setValue('model', null)
                  probe.mutate({ id })
                }}
              />
            )}
          />
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

      {efforts.length > 0 ? (
        <Controller
          control={form.control}
          name="effort"
          render={({ field }) => (
            <Row label="Effort">
              <EffortControl
                values={efforts}
                value={field.value ?? 'medium'}
                onChange={field.onChange}
                className="w-[170px]"
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
