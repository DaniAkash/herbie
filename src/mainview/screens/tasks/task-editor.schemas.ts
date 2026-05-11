import { z } from 'zod'

// Mirrors the server-side schema in src/bun/routes/tasks.ts. Kept in
// sync by hand — when the API schema grows, this one grows with it.
// We can't import the server schema directly because it lives in the
// Bun-only side of the codebase.

export const AGENT_IDS = ['claude', 'codex', 'gemini', 'hermes'] as const

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
      .max(120, 'Cron expression is too long'),
  }),
])

export const taskFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(120, 'Name must be 120 characters or fewer'),
  prompt: z.string().trim().min(1, 'Prompt is required'),
  agentId: z.enum(AGENT_IDS, { message: 'Pick an agent' }),
  modelId: z.string().min(1).nullable(),
  workspacePath: z.string().min(1).nullable(),
  reasoningEffort: z.string().min(1).nullable(),
  schedule: scheduleSchema,
})

export type TaskFormValues = z.infer<typeof taskFormSchema>
