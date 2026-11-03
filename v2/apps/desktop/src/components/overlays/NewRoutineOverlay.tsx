import { createRoutineBody } from '@bun/shared/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Check, X } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/motion/input'
import { Switch } from '@/components/motion/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import { Overlay } from '@/components/shell/Overlay'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import { Textarea } from '@/components/ui/textarea'
import { useAgents, useCreateRoutine } from '@/modules/api/agents.hooks'
import { useReadCadence } from '@/modules/api/cadence.hooks'
import { closeOverlay } from '@/modules/navigation/overlay'

type RoutineInput = z.input<typeof createRoutineBody>
type RoutineDraft = z.output<typeof createRoutineBody>

/** Work the agent starts by itself, added after it exists. */
export function NewRoutineOverlay() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { agentId?: string }
  const agentId = params.agentId
  const { data } = useAgents()
  const agent = data?.agents.find((a) => a.id === agentId)
  const create = useCreateRoutine()
  const read = useReadCadence()

  const form = useForm<RoutineInput, unknown, RoutineDraft>({
    resolver: zodResolver(createRoutineBody),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      kind: 'schedule',
      cadence: '',
      prompt: '',
      deliverTelegram: false,
    },
  })

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

        <Field label={kind === 'event' ? 'When' : 'When'}>
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

        <div>
          <span className="mb-1.5 block font-medium text-[12.5px] text-ink-2">
            Where the result goes
          </span>
          <PanelSection>
            <PanelRow k="This conversation" v="Where you already talk to it">
              <span className="rounded-full bg-field px-2 py-0.5 text-[11.5px] text-ink-2">
                always
              </span>
            </PanelRow>
            <Controller
              control={form.control}
              name="deliverTelegram"
              render={({ field }) => (
                <PanelRow
                  k="Telegram too"
                  v={
                    agent?.telegramBot
                      ? `Sent from ${agent.telegramBot}`
                      : 'Needs its bot connected first'
                  }
                >
                  <Switch
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                    disabled={!agent?.telegramBot}
                    ariaLabel="Telegram too"
                  />
                </PanelRow>
              )}
            />
          </PanelSection>
        </div>
      </div>
    </Overlay>
  )
}

/**
 * What the sidecar made of the cadence.
 *
 * Shown as a failure rather than hidden when it did not parse: a routine
 * stored without a cron is one that never fires, and finding that out later
 * is worse than being told now.
 */
function CadenceLine({
  reading,
  cron,
  pending,
}: {
  reading?: string
  cron?: string | null
  pending: boolean
}) {
  if (pending) {
    return <p className="mt-1.5 text-[12.5px] text-ink-3">Reading that...</p>
  }
  if (!cron) {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-red">
        <X size={13} />
        Herbie could not read that, so it will not run on its own.
      </p>
    )
  }
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink-2">
      <Check size={13} className="text-accent" />
      Herbie read that as {reading}
      <code className="rounded bg-field px-1.5 py-0.5 font-mono text-[11.5px]">
        {cron}
      </code>
    </p>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="mb-1.5 block font-medium text-[12.5px] text-ink-2">
        {label}
      </span>
      {children}
    </div>
  )
}
