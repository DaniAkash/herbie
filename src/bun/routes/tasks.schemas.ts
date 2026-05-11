import { Cron } from 'croner'
import { z } from 'zod'
import { TASK_STATUSES } from '../../db/schema/tasks.sql'

export const AGENT_IDS = ['claude', 'codex', 'gemini', 'hermes'] as const

// ScheduleConfig — kept as a discriminated union mirroring the
// renderer's shape. Stored as JSON on the row; validated here.
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
    cron: z.string().min(1).max(120).refine(isValidCronExpression, {
      message: 'Not a valid cron expression',
    }),
  }),
])

// croner's constructor throws synchronously on a malformed pattern.
// Wrap it so we can use it as a refinement predicate; `paused: true`
// keeps the validator side-effect-free (no timer is scheduled).
function isValidCronExpression(value: string): boolean {
  try {
    new Cron(value, { paused: true })
    return true
  } catch {
    return false
  }
}

// Extra delivery channels beyond inbox (inbox is implicit). Today
// the only candidate is telegram, but its toggle is disabled in the
// UI until the feature ships, so this is effectively always [].
export const outputSchema = z.array(z.enum(['telegram']))

const tupleFields = {
  modelId: z.string().min(1).nullish(),
  workspacePath: z.string().min(1).nullish(),
  reasoningEffort: z.string().min(1).nullish(),
} as const

export const createSchema = z
  .object({
    name: z.string().min(1).max(120),
    prompt: z.string().min(1),
    agentId: z.enum(AGENT_IDS),
    schedule: scheduleSchema,
    outputs: outputSchema.optional(),
    ...tupleFields,
  })
  .strict()

export const updateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    prompt: z.string().min(1).optional(),
    agentId: z.enum(AGENT_IDS).optional(),
    schedule: scheduleSchema.optional(),
    outputs: outputSchema.optional(),
    status: z.enum(TASK_STATUSES).optional(),
    ...tupleFields,
  })
  .strict()

export const testSchema = z
  .object({
    // All four are optional overrides; if any are omitted, the run
    // falls back to the persisted task row.
    prompt: z.string().min(1).optional(),
    agentId: z.enum(AGENT_IDS).optional(),
    ...tupleFields,
  })
  .strict()
