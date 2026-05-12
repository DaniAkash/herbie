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
import { Spinner } from '@/components/ui/spinner'

// Accept the same source shapes the package's parseSourceInput recognises:
// owner/repo[#ref], any git/http URL (including SSH `git@host:org/repo`
// and `*.git` variants), or a local path (absolute / relative / ~). The
// server runs the real parse and may still reject anything past the first
// sniff (e.g. a non-existent local path) with a SourceParseError.
const formSchema = z.object({
  source: z
    .string()
    .trim()
    .min(1, 'Required')
    .refine(
      (s) =>
        /^[\w.-]+\/[\w.-]+(#[\w.-]+)?$/.test(s) ||
        /^https?:\/\//i.test(s) ||
        /^git@[^:]+:.+$/.test(s) ||
        /^git:\/\//i.test(s) ||
        /\.git(#[\w.-]+)?$/i.test(s) ||
        s.startsWith('/') ||
        s.startsWith('~') ||
        s.startsWith('.'),
      { message: 'Use owner/repo, a git URL, or a local path' },
    ),
})

type FormValues = z.infer<typeof formSchema>

export function SkillForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (source: string) => void | Promise<void>
  isPending: boolean
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { source: '' },
  })

  const sourceError = form.formState.errors.source

  async function handleSubmit(values: FormValues): Promise<void> {
    await onSubmit(values.source.trim())
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex flex-col gap-5"
    >
      <DialogHeader>
        <DialogTitle>Install a skill</DialogTitle>
        <DialogDescription>
          The skill lands in your workspace at{' '}
          <span className="font-mono text-xs">~/.herbie/skills</span>. You'll
          choose which agents pick it up after it's installed.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field data-invalid={sourceError ? '' : undefined}>
          <FieldLabel htmlFor="skill-source">Source</FieldLabel>
          <Input
            id="skill-source"
            placeholder="vercel-labs/agent-skills"
            autoComplete="off"
            spellCheck={false}
            {...form.register('source')}
            aria-invalid={sourceError ? true : undefined}
          />
          <FieldDescription>
            GitHub <span className="font-mono">owner/repo</span> (optionally{' '}
            <span className="font-mono">#ref</span>), a full git URL, or an
            absolute local path. If the source has multiple skills, all of them
            are installed.
          </FieldDescription>
          {sourceError && <FieldError>{sourceError.message}</FieldError>}
        </Field>
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
        <Button type="submit" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          Install
        </Button>
      </DialogFooter>
    </form>
  )
}
