'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  type ConversationSummary,
  useRenameConversation,
} from '@/modules/api/chat.hooks'

const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(200, 'Keep titles under 200 characters'),
})

type FormValues = z.infer<typeof formSchema>

export function RenameConversationDialog({
  open,
  onOpenChange,
  conv,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  conv: ConversationSummary
}) {
  const rename = useRenameConversation()
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: conv.title },
  })

  // Re-seed the field when a different conversation is targeted while
  // the dialog is mounted (e.g. user right-clicks another row).
  // biome-ignore lint/correctness/useExhaustiveDependencies: form ref is stable
  useEffect(() => {
    form.reset({ title: conv.title })
  }, [conv.id, conv.title])

  const titleError = form.formState.errors.title

  async function handleSubmit(values: FormValues): Promise<void> {
    const trimmed = values.title.trim()
    if (trimmed === conv.title) {
      onOpenChange(false)
      return
    }
    try {
      await rename.mutateAsync({ id: conv.id, title: trimmed })
      onOpenChange(false)
    } catch {
      // toastApiError already surfaced on the mutation; leave dialog
      // open so the user can edit and retry.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-5"
        >
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              The new title shows up in the sidebar and conversation header.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={titleError ? '' : undefined}>
              <FieldLabel htmlFor="conv-title">Title</FieldLabel>
              <Input
                id="conv-title"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                maxLength={200}
                {...form.register('title')}
                aria-invalid={titleError ? true : undefined}
              />
              {titleError && <FieldError>{titleError.message}</FieldError>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="submit" disabled={rename.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
