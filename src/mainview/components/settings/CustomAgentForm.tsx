'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { CustomAgentDraft } from '@/modules/api/settings.hooks'

// Mirrors customAgentSchema in src/bun/routes/settings.ts. We don't
// import the server schema directly (Bun-only side), so this is the
// canonical client-side validation surface.
const formSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(64, 'Max 64 characters')
    .regex(
      /^[a-z0-9][a-z0-9\-_.]*$/i,
      'Letters/digits/-/_/. only, must start with a letter or digit',
    ),
  displayName: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(64, 'Max 64 characters'),
  command: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(2000, 'Max 2000 characters'),
})

type FormValues = z.infer<typeof formSchema>

export function CustomAgentForm({
  initial,
  onSubmit,
  isPending,
  // When editing an existing custom agent the wire `id` is referenced
  // by chat/task/telegram rows, so the field is rendered read-only and
  // the form short-circuits validation for it.
  isEditing = false,
}: {
  initial?: CustomAgentDraft
  onSubmit: (draft: CustomAgentDraft) => void | Promise<void>
  isPending: boolean
  isEditing?: boolean
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: initial?.id ?? '',
      displayName: initial?.displayName ?? '',
      command: initial?.command ?? '',
    },
  })

  const idError = form.formState.errors.id
  const displayNameError = form.formState.errors.displayName
  const commandError = form.formState.errors.command

  async function handleSubmit(values: FormValues): Promise<void> {
    await onSubmit({
      id: values.id.trim(),
      displayName: values.displayName.trim(),
      command: values.command.trim(),
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex flex-col gap-5"
    >
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit agent' : 'Add agent'}</DialogTitle>
        <DialogDescription>
          Point Herbie at any ACP-compatible CLI. The command runs as a
          subprocess on every new conversation — env vars set in your shell are
          inherited.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field data-invalid={idError ? '' : undefined}>
          <FieldLabel htmlFor="custom-agent-id">Agent id</FieldLabel>
          <Input
            id="custom-agent-id"
            placeholder="my-agent"
            autoComplete="off"
            spellCheck={false}
            // readOnly, not disabled — disabled fields are excluded
            // from form submission in react-hook-form, which would
            // strip the id on edit and break the zod resolver.
            readOnly={isEditing}
            {...form.register('id')}
            aria-invalid={idError ? true : undefined}
          />
          <FieldDescription>
            Wire identifier — appears in the agent picker and is pinned on every
            chat/task created with this agent. Can't be changed once set.
          </FieldDescription>
          {idError && <FieldError>{idError.message}</FieldError>}
        </Field>

        <Field data-invalid={displayNameError ? '' : undefined}>
          <FieldLabel htmlFor="custom-agent-display-name">
            Display name
          </FieldLabel>
          <Input
            id="custom-agent-display-name"
            placeholder="My Agent"
            autoComplete="off"
            {...form.register('displayName')}
            aria-invalid={displayNameError ? true : undefined}
          />
          {displayNameError && (
            <FieldError>{displayNameError.message}</FieldError>
          )}
        </Field>

        <Field data-invalid={commandError ? '' : undefined}>
          <FieldLabel htmlFor="custom-agent-command">Command</FieldLabel>
          <Input
            id="custom-agent-command"
            placeholder="my-acp-agent --stdio"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            {...form.register('command')}
            aria-invalid={commandError ? true : undefined}
          />
          <FieldDescription>
            Shell-split before spawn. Use{' '}
            <span className="font-mono">env KEY=value …</span> as a prefix if
            you need per-agent env vars.
          </FieldDescription>
          {commandError && <FieldError>{commandError.message}</FieldError>}
        </Field>
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
        <Button type="submit" disabled={isPending}>
          {isEditing ? 'Save' : 'Add agent'}
        </Button>
      </DialogFooter>
    </form>
  )
}
