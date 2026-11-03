import { createAgentBody } from '@bun/shared/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { UseFormReturn } from 'react-hook-form'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { AgentFace } from '@/components/agent/AgentFace'
import { Button } from '@/components/atoms/Button'

import {
  ColorSelector,
  ColorSelectorItem,
  ColorSelectorList,
} from '@/components/motion/color-selector'
import { Input } from '@/components/motion/input'
import { BackButton, Steps } from '@/components/overlays/new-agent.components'
import { RunsOnStep } from '@/components/overlays/RunsOnStep'
import { Overlay } from '@/components/shell/Overlay'
import { Textarea } from '@/components/ui/textarea'
import { useCreateAgent } from '@/modules/api/agents.hooks'
import { atStep, closeOverlay } from '@/modules/navigation/overlay'

const COLORS = ['ops', 'scout', 'post', 'mail', 'house', 'watch'] as const

/**
 * Two types, not one, because the schema fills defaults.
 *
 * What the fields hold has `brief` and `effort` optional; what comes out the
 * other side of the resolver has them filled. Handing useForm one type for
 * both is what makes it reject its own resolver.
 */
export type AgentDraftInput = z.input<typeof createAgentBody>
export type AgentDraft = z.output<typeof createAgentBody>
export type AgentForm = UseFormReturn<AgentDraftInput, unknown, AgentDraft>

/**
 * Two steps: who it is, then how it runs.
 *
 * Two rather than one because the runtime is the only thing here that cannot
 * be defaulted, and the model and effort rows cannot be drawn until it is
 * known. Everything else an agent carries has a safe default and so lives
 * behind creation, in the panel.
 *
 * The form is mounted across both steps and the step itself is a search
 * param, so Back is a history step and a half filled draft survives it.
 */
export function NewAgentOverlay() {
  const navigate = useNavigate()
  const { step } = useSearch({ strict: false }) as { step?: 'who' | 'runs' }
  const create = useCreateAgent()

  const form = useForm<AgentDraftInput, unknown, AgentDraft>({
    resolver: zodResolver(createAgentBody),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      color: 'house',
      brief: '',
      acpAgent: '',
      model: null,
      effort: 'medium',
      workspaceDir: null,
    },
  })

  const name = form.watch('name')
  const onRuns = step === 'runs'

  const submit = form.handleSubmit(async (draft) => {
    const { agent } = await create.mutateAsync(draft)
    navigate({
      to: '/agents/$agentId',
      params: { agentId: agent.id },
      search: closeOverlay,
    })
  })

  return (
    <Overlay
      title="New agent"
      narrow
      lead={
        onRuns ? (
          <BackButton
            onClick={() => navigate({ to: '.', search: atStep('who') })}
          />
        ) : undefined
      }
      footer={
        onRuns ? (
          <>
            <Button
              size="sm"
              variant="quiet"
              type="button"
              onClick={() => navigate({ to: '.', search: atStep('who') })}
            >
              Back
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="button"
              disabled={create.isPending || !form.watch('acpAgent')}
              onClick={submit}
            >
              {create.isPending ? 'Creating...' : `Create ${name || 'agent'}`}
            </Button>
          </>
        ) : (
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
              disabled={!name.trim()}
              onClick={async () => {
                // Only the first step's fields, so an unanswered runtime does
                // not read as an error before it has been asked for.
                const ok = await form.trigger(['name', 'color', 'brief'])
                if (ok) navigate({ to: '.', search: atStep('runs') })
              }}
            >
              Next
            </Button>
          </>
        )
      }
    >
      <Steps name={onRuns ? name : undefined} />
      {onRuns ? <RunsOnStep form={form} /> : <WhoItIsStep form={form} />}
      {create.isError ? (
        <p className="mt-3 text-[12.5px] text-red">
          {create.error instanceof Error
            ? create.error.message
            : 'It could not be created.'}
        </p>
      ) : null}
    </Overlay>
  )
}

/** A face, a name, a colour, and what it should do. */
function WhoItIsStep({ form }: { form: AgentForm }) {
  const color = form.watch('color')

  return (
    <div className="grid justify-items-center gap-4">
      <AgentFace color={color} size="lg" />
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <Input
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            placeholder="Give it a name"
            className="text-center"
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="color"
        render={({ field }) => (
          <ColorSelector
            value={field.value}
            onValueChange={field.onChange}
            aria-label="Colour"
          >
            <ColorSelectorList>
              {COLORS.map((c) => (
                <ColorSelectorItem
                  key={c}
                  value={c}
                  color={`var(--f-${c})`}
                  label={c}
                />
              ))}
            </ColorSelectorList>
          </ColorSelector>
        )}
      />
      <Controller
        control={form.control}
        name="brief"
        render={({ field }) => (
          <Textarea
            {...field}
            value={field.value ?? ''}
            placeholder="What should it do? Plain language is fine."
            className="min-h-[74px]"
          />
        )}
      />
    </div>
  )
}
