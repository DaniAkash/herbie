import { skipToken } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { useEffect } from 'react'
import { Controller } from 'react-hook-form'
import { EffortControl } from '@/components/agent/EffortControl'

import {
  FolderSection,
  Note,
  ProbeLine,
  Row,
} from '@/components/overlays/runs-on.components'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { modelItems, OWN_DEFAULT } from '@/lib/models'
import { usePlannedWorkspace } from '@/modules/api/agents.hooks'
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
 *
 * Only runtimes that are installed are offered. The ones acpx would fetch on
 * first use are real but are not a choice anyone makes while naming their
 * first agent, and the panel still lists them once the agent exists.
 */
/** Hoisted so the effect below has a stable dependency when nothing is probed. */
const NO_EFFORTS: readonly string[] = []

export function RunsOnStep({ form }: { form: AgentForm }) {
  const { data, isPending } = useRuntimes()
  const probe = useProbeRuntime()
  const chosen = form.watch('acpAgent')
  const name = form.watch('name').trim()
  // Nothing to plan a folder for until there is a name, and the schema would
  // refuse the empty one.
  const planned = usePlannedWorkspace({
    variables: name ? { name } : skipToken,
  })

  const runtimes = data?.runtimes ?? []
  const installed = runtimes.filter((r) => r.installState === 'installed')
  // The probe's own answer wins while it is on screen, so the rows fill in
  // the moment it lands rather than after the list is refetched.
  const probed: Runtime | undefined =
    probe.data && probe.data.runtime.id === chosen
      ? probe.data.runtime
      : runtimes.find((r) => r.id === chosen)

  const efforts = probed?.efforts ?? NO_EFFORTS
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
        <Controller
          control={form.control}
          name="acpAgent"
          render={({ field }) => (
            <Select
              value={field.value || null}
              onValueChange={(id) => {
                if (id === null) return
                field.onChange(id)
                // The model the previous runtime offered means nothing to this
                // one, so it goes rather than being carried across as a value
                // it will refuse.
                form.setValue('model', null)
                probe.mutate({ id })
              }}
              items={installed.map((r) => ({
                value: r.id,
                label: r.displayName,
              }))}
              disabled={isPending || installed.length === 0}
            >
              <SelectTrigger className="w-full" aria-label="Runs on">
                <SelectValue
                  placeholder={isPending ? 'Looking...' : 'Pick one'}
                />
              </SelectTrigger>
              <SelectContent>
                {installed.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {!isPending && installed.length === 0 ? (
          <Note icon={<Info size={14} />}>
            Herbie runs each agent inside a coding agent, and none is installed
            on this machine yet.
          </Note>
        ) : null}
        <ProbeLine pending={probe.isPending} runtime={probed} />
      </section>

      {probed && probed.modelValues.length > 0 ? (
        <Controller
          control={form.control}
          name="model"
          render={({ field }) => (
            <Row label="Model">
              <Select
                value={field.value ?? null}
                onValueChange={field.onChange}
                items={modelItems(probed.modelValues)}
              >
                <SelectTrigger className="w-[170px]" aria-label="Model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>{OWN_DEFAULT}</SelectItem>
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

      <FolderSection form={form} planned={planned.data?.path} />
    </div>
  )
}
