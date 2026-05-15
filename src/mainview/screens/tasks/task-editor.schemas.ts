import { Cron } from 'croner'
import { z } from 'zod'

// Mirrors the server-side schema in src/bun/routes/tasks.ts. Kept in
// sync by hand — when the API schema grows, this one grows with it.
// We can't import the server schema directly because it lives in the
// Bun-only side of the codebase.
//
// agentId is free-form here too. The task form should disable the
// Save button when the picker's value isn't in the live useAgents()
// list; the schema's only job is to ensure the field isn't empty.

export const scheduleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('daily'),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  z.object({
    kind: z.literal('interval'),
    hours: z.number().int().min(1).max(168),
  }),
  z.object({
    kind: z.literal('weekly'),
    weekday: z.number().int().min(0).max(6),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  z.object({
    kind: z.literal('cron'),
    cron: z
      .string()
      .min(1, 'Cron expression is required')
      .max(120, 'Cron expression is too long')
      .refine(isValidCronExpression, {
        message:
          'Not a valid cron expression. Five space-separated fields, e.g. "0 9 * * *" for 9am daily.',
      }),
  }),
])

// croner's constructor throws synchronously on a malformed pattern.
// Wrap it so the form can flag bad input inline before the user
// hits Save. `paused: true` makes this side-effect-free — no timer
// is started.
function isValidCronExpression(value: string): boolean {
  try {
    new Cron(value, { paused: true })
    return true
  } catch {
    return false
  }
}

export const taskFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(120, 'Name must be 120 characters or fewer'),
  prompt: z.string().trim().min(1, 'Prompt is required'),
  agentId: z.string().min(1, 'Pick an agent'),
  modelId: z.string().min(1).nullable(),
  workspacePath: z.string().min(1).nullable(),
  reasoningEffort: z.string().min(1).nullable(),
  schedule: scheduleSchema,
})

export type TaskFormValues = z.infer<typeof taskFormSchema>
