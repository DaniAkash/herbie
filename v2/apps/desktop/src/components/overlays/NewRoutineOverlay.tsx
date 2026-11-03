import { useNavigate, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Controller } from 'react-hook-form'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/motion/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import {
  CadenceLine,
  Delivery,
  Field,
} from '@/components/overlays/new-routine.components'
import { Overlay } from '@/components/shell/Overlay'
import { Textarea } from '@/components/ui/textarea'
import { useAgents, useCreateRoutine } from '@/modules/api/agents.hooks'
import { useReadCadence } from '@/modules/api/cadence.hooks'
import { useRoutineDraftForm } from '@/modules/api/forms'
import { closeOverlay } from '@/modules/navigation/overlay'

/** Work the agent starts by itself, added after it exists. */
export function NewRoutineOverlay() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { agentId?: string }
  const agentId = params.agentId
  const { data } = useAgents()
  const agent = data?.agents.find((a) => a.id === agentId)
  const create = useCreateRoutine()
  const read = useReadCadence()

  const form = useRoutineDraftForm()

  const kind = form.watch('kind')
  const cadence = form.watch('cadence')

  // Asked of the sidecar rather than parsed here, so what is shown is the
  // same parse the routine will be stored with.
  useEffect(() => {
    const text = (cadence ?? '').trim()
    if (kind !== 'schedule' || !text) return
    const timer = setTimeout(() => read.mutate({ text }), 200)
    return () => clearTimeout(timer)
  }, [cadence, kind, read.mutate])

  if (!agentId) return null

  const submit = form.handleSubmit(async (draft) => {
    await create.mutateAsync({ agentId, ...draft })
    navigate({ to: '.', search: closeOverlay })
  })

  return (
    <Overlay
      title="New routine"
      narrow
      footer={
        <>
          <Button
            size="sm"
            variant="quiet"
            type="button"
            onClick={() => navigate({ to: '.', search: closeOverlay })}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="button"
            disabled={create.isPending}
            onClick={submit}
          >
            {create.isPending ? 'Adding...' : 'Add'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <Field label="Name">
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Input
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Morning read"
                error={fieldState.error?.message}
              />
            )}
          />
        </Field>

        <Field label="What starts it">
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <Tabs
                value={field.value ?? 'schedule'}
                variant="segment"
                onValueChange={field.onChange}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="schedule" className="flex-1">
                    A time
                  </TabsTrigger>
                  <TabsTrigger value="event" className="flex-1">
                    Something happening
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          />
        </Field>

        <Field label="When">
          <Controller
            control={form.control}
            name="cadence"
            render={({ field, fieldState }) => (
              <Input
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={
                  kind === 'event'
                    ? 'when a tag is pushed'
                    : 'every weekday at seven'
                }
                error={fieldState.error?.message}
              />
            )}
          />
          {kind === 'schedule' && (cadence ?? '').trim() ? (
            <CadenceLine
              reading={read.data?.cadence?.reading}
              cron={read.data?.cadence?.cron}
              pending={read.isPending}
            />
          ) : null}
        </Field>

        <Field label="What to do">
          <Controller
            control={form.control}
            name="prompt"
            render={({ field }) => (
              <Textarea
                {...field}
                value={field.value ?? ''}
                placeholder="Read everything that arrived overnight and keep the three worth my time."
                className="min-h-[74px]"
              />
            )}
          />
        </Field>

        <Controller
          control={form.control}
          name="deliverTelegram"
          render={({ field }) => (
            <Delivery
              agent={agent}
              telegram={Boolean(field.value)}
              onTelegram={field.onChange}
            />
          )}
        />
      </div>
    </Overlay>
  )
}
