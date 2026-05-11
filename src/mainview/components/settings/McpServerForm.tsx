'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { DynamicList } from '@/components/settings/McpServerForm.parts'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { McpServer, McpServerDraft } from '@/modules/api/settings.hooks'

const namedValueSchema = z.object({
  name: z.string().min(1, 'Required'),
  value: z.string().min(1, 'Required'),
})

const formSchema = z
  .object({
    name: z.string().min(1, 'Required'),
    type: z.enum(['stdio', 'http', 'sse']),
    command: z.string(),
    args: z.array(z.object({ value: z.string() })),
    env: z.array(namedValueSchema),
    url: z.string(),
    headers: z.array(namedValueSchema),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'stdio') {
      if (!data.command.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['command'],
          message: 'Command is required for stdio servers',
        })
      }
      return
    }
    if (!data.url.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'URL is required',
      })
    } else if (!/^https?:\/\//i.test(data.url)) {
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'URL must start with http:// or https://',
      })
    }
  })

type FormValues = z.infer<typeof formSchema>
type Form = UseFormReturn<FormValues>

const EMPTY_FORM: FormValues = {
  name: '',
  type: 'stdio',
  command: '',
  args: [],
  env: [],
  url: '',
  headers: [],
}

function toFormValues(server: McpServer | null): FormValues {
  if (!server) return EMPTY_FORM
  if (server.type === 'stdio') {
    return {
      name: server.name,
      type: 'stdio',
      command: server.command,
      args: server.args.map((value) => ({ value })),
      env: server.env,
      url: '',
      headers: [],
    }
  }
  return {
    name: server.name,
    type: server.type,
    command: '',
    args: [],
    env: [],
    url: server.url,
    headers: server.headers,
  }
}

function toDraft(values: FormValues): McpServerDraft {
  if (values.type === 'stdio') {
    return {
      type: 'stdio',
      name: values.name.trim(),
      command: values.command.trim(),
      args: values.args.map((a) => a.value).filter((a) => a.length > 0),
      env: values.env.map((e) => ({ name: e.name.trim(), value: e.value })),
    }
  }
  return {
    type: values.type,
    name: values.name.trim(),
    url: values.url.trim(),
    headers: values.headers.map((h) => ({
      name: h.name.trim(),
      value: h.value,
    })),
  }
}

export function McpServerForm({
  server,
  existingNames,
  onSubmit,
}: {
  server: McpServer | null
  existingNames: string[]
  onSubmit: (draft: McpServerDraft) => void
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(server),
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: form ref is stable; we re-seed on identity change
  useEffect(() => {
    form.reset(toFormValues(server))
  }, [server])

  const watchedType = form.watch('type')

  function handleSubmit(values: FormValues): void {
    const trimmed = values.name.trim()
    if (existingNames.includes(trimmed)) {
      form.setError('name', { message: 'Already used by another server' })
      return
    }
    onSubmit(toDraft(values))
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex flex-col gap-5"
    >
      <DialogHeader>
        <DialogTitle>
          {server ? 'Edit MCP server' : 'Add MCP server'}
        </DialogTitle>
        <DialogDescription>
          Tools from this server become available to every agent on a new
          conversation. Changes don't reach conversations that are already open.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <NameField form={form} />
        <TransportPicker form={form} value={watchedType} />
        {watchedType === 'stdio' ? (
          <StdioFields form={form} />
        ) : (
          <HttpFields form={form} />
        )}
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
        <Button type="submit">{server ? 'Save' : 'Add server'}</Button>
      </DialogFooter>
    </form>
  )
}

function NameField({ form }: { form: Form }) {
  const error = form.formState.errors.name
  return (
    <Field data-invalid={error ? '' : undefined}>
      <FieldLabel htmlFor="mcp-name">Name</FieldLabel>
      <Input
        id="mcp-name"
        placeholder="filesystem"
        {...form.register('name')}
        aria-invalid={error ? true : undefined}
      />
      <FieldDescription>
        How the agent refers to this server. Must be unique.
      </FieldDescription>
      {error && <FieldError>{error.message}</FieldError>}
    </Field>
  )
}

function TransportPicker({
  form,
  value,
}: {
  form: Form
  value: FormValues['type']
}) {
  return (
    <Field>
      <FieldLabel>Transport</FieldLabel>
      <ToggleGroup
        value={[value]}
        onValueChange={(v: string[]) => {
          if (v[0] === 'stdio' || v[0] === 'http' || v[0] === 'sse') {
            form.setValue('type', v[0])
          }
        }}
        variant="outline"
      >
        <ToggleGroupItem value="stdio">stdio</ToggleGroupItem>
        <ToggleGroupItem value="http">http</ToggleGroupItem>
        <ToggleGroupItem value="sse">sse</ToggleGroupItem>
      </ToggleGroup>
    </Field>
  )
}

function StdioFields({ form }: { form: Form }) {
  const argsArray = useFieldArray({ control: form.control, name: 'args' })
  const envArray = useFieldArray({ control: form.control, name: 'env' })
  const commandError = form.formState.errors.command
  return (
    <>
      <Field data-invalid={commandError ? '' : undefined}>
        <FieldLabel htmlFor="mcp-command">Command</FieldLabel>
        <Input
          id="mcp-command"
          placeholder="npx -y @modelcontextprotocol/server-filesystem"
          {...form.register('command')}
          aria-invalid={commandError ? true : undefined}
        />
        {commandError && <FieldError>{commandError.message}</FieldError>}
      </Field>

      <Field>
        <FieldLabel>Arguments</FieldLabel>
        <DynamicList
          kind="args"
          rows={argsArray.fields}
          onAdd={() => argsArray.append({ value: '' })}
          onRemove={(idx) => argsArray.remove(idx)}
          renderRow={(_field, idx) => (
            <Input
              placeholder="/Users/dani/Documents"
              {...form.register(`args.${idx}.value`)}
            />
          )}
        />
      </Field>

      <Field>
        <FieldLabel>Environment</FieldLabel>
        <FieldDescription>
          {/* TODO(secrets): plaintext storage in ~/.herbie/data.db for v1; promote to Keychain later. */}
          Stored in plain text on this Mac.
        </FieldDescription>
        <DynamicList
          kind="env"
          rows={envArray.fields}
          onAdd={() => envArray.append({ name: '', value: '' })}
          onRemove={(idx) => envArray.remove(idx)}
          renderRow={(_field, idx) => (
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="NAME"
                className="basis-1/3"
                {...form.register(`env.${idx}.name`)}
              />
              <Input
                placeholder="value"
                className="flex-1"
                {...form.register(`env.${idx}.value`)}
              />
            </div>
          )}
        />
      </Field>
    </>
  )
}

function HttpFields({ form }: { form: Form }) {
  const headersArray = useFieldArray({
    control: form.control,
    name: 'headers',
  })
  const urlError = form.formState.errors.url
  return (
    <>
      <Field data-invalid={urlError ? '' : undefined}>
        <FieldLabel htmlFor="mcp-url">URL</FieldLabel>
        <Input
          id="mcp-url"
          placeholder="https://mcp.example.com/sse"
          {...form.register('url')}
          aria-invalid={urlError ? true : undefined}
        />
        {urlError && <FieldError>{urlError.message}</FieldError>}
      </Field>

      <Field>
        <FieldLabel>Headers</FieldLabel>
        <DynamicList
          kind="headers"
          rows={headersArray.fields}
          onAdd={() => headersArray.append({ name: '', value: '' })}
          onRemove={(idx) => headersArray.remove(idx)}
          renderRow={(_field, idx) => (
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="Authorization"
                className="basis-1/3"
                {...form.register(`headers.${idx}.name`)}
              />
              <Input
                placeholder="Bearer …"
                className="flex-1"
                {...form.register(`headers.${idx}.value`)}
              />
            </div>
          )}
        />
      </Field>
    </>
  )
}
